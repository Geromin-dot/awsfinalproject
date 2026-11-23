import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { categories, sortPosts, validDueDate } from "../../lib/board";
import { Conflict, deletePost, download, listPosts, mode, savePost } from "../../lib/storage";

const MAX_PDF = 2 * 1024 * 1024;
const SESSION = 8 * 60 * 60;
const cookieName = "board_session";
export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };

function equal(first, second) {
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(first), digest(second));
}

function signature(payload) {
  return createHmac("sha256", process.env.BOARD_SESSION_SECRET).update(payload).digest("hex");
}

function hasSession(req) {
  if (mode() === "local") return true;
  if (!process.env.BOARD_SESSION_SECRET) return false;
  const [payload, token] = (req.cookies[cookieName] || "").split(".");
  const expiry = Number(payload.split(":")[0]);
  return expiry > Date.now() && Boolean(token) && equal(token, signature(payload));
}

function setSession(res, signedIn) {
  const payload = new Date(Date.now() + SESSION * 1000).getTime() + ":" + randomUUID();
  const value = signedIn ? payload + "." + signature(payload) : "";
  const secure = (mode() === "aws" || process.env.VERCEL) ? "; Secure" : "";
  res.setHeader("Set-Cookie", cookieName + "=" + value + "; Path=/; HttpOnly; SameSite=Strict; Max-Age="
    + (signedIn ? SESSION : 0) + secure);
}

function sameOrigin(req) {
  const origin = process.env.BOARD_ORIGIN;
  if (origin) return req.headers.origin === origin;
  return mode() === "local" && req.headers.origin === "http://" + req.headers.host;
}

function publicPost(post) {
  const { attachment, ...details } = post;
  return { ...details, attachment: attachment ? { name: attachment.name } : null };
}

function parsePdf(file) {
  if (!file || typeof file.name !== "string" || typeof file.data !== "string"
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.data)) return null;
  const bytes = Buffer.from(file.data, "base64");
  if (!/\.pdf$/i.test(file.name) || bytes.length > MAX_PDF
    || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return null;
  const name = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, -4).slice(0, 100) + ".pdf";
  return { bytes, name };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "GET") {
      const posts = sortPosts(await listPosts());
      if (req.query.download) {
        const attachment = posts.find((post) => post.id === req.query.download)?.attachment;
        const bytes = attachment && await download(attachment);
        if (!bytes) return res.status(404).json({ error: "Attachment unavailable." });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="' + attachment.name + '"');
        return res.send(bytes);
      }
      return res.json({ posts: posts.map(publicPost), teacher: hasSession(req), mode: mode() });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).end();
    }
    if (mode() === "preview") return res.status(503).json({ error: "Teacher tools need a configured server." });
    if (!sameOrigin(req)) return res.status(403).json({ error: "Request origin could not be verified." });

    const body = req.body || {};
    if (body.action === "login") {
      const password = process.env.BOARD_TEACHER_PASSWORD;
      if (!password || !process.env.BOARD_SESSION_SECRET) {
        return res.status(503).json({ error: "Teacher sign-in has not been configured." });
      }
      if (typeof body.password !== "string" || !equal(body.password, password)) {
        return res.status(401).json({ error: "Incorrect teacher password." });
      }
      setSession(res, true);
      return res.json({ teacher: true });
    }
    if (body.action === "logout") {
      setSession(res, false);
      return res.json({ teacher: false });
    }
    if (!hasSession(req)) return res.status(401).json({ error: "Sign in as a teacher to make changes." });

    const previous = body.id ? (await listPosts()).find((post) => post.id === body.id) : undefined;
    if (body.id && !previous) return res.status(404).json({ error: "This announcement no longer exists." });
    if (previous && body.revision !== previous.revision) throw new Conflict();

    if (body.action === "delete" && previous) {
      await deletePost(previous);
      return res.json({ ok: true });
    }
    if (body.action === "pin" && previous) {
      await savePost({ ...previous, pinned: !previous.pinned, revision: previous.revision + 1 }, previous);
      return res.json({ ok: true });
    }
    if (body.action !== "save") return res.status(400).json({ error: "Unknown action." });

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!title || title.length > 100 || !message || message.length > 2000 || !categories.includes(body.category)) {
      return res.status(400).json({ error: "Enter a category, a title of 1–100 characters, and a message of 1–2,000 characters." });
    }
    const dueDate = body.dueDate ?? previous?.dueDate ?? "";
    if (dueDate !== "" && !validDueDate(dueDate)) return res.status(400).json({ error: "Enter a valid deadline." });
    const pdf = body.file ? parsePdf(body.file) : null;
    if (body.file && !pdf) return res.status(400).json({ error: "Choose a PDF file up to 2 MB." });
    const id = previous?.id || randomUUID();
    const attachment = pdf ? { key: "attachments/" + id + "/" + randomUUID() + ".pdf", name: pdf.name }
      : body.removeAttachment ? null : previous?.attachment || null;
    await savePost({
      id, title, message, dueDate, category: body.category, pinned: body.pinned === true, attachment,
      createdAt: previous?.createdAt || new Date().toISOString(), revision: (previous?.revision || 0) + 1,
    }, previous, pdf?.bytes);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof Conflict) return res.status(409).json({ error: "This announcement changed. Refresh the board and try again." });
    console.error("Board request failed:", error.name, error.code);
    return res.status(500).json({ error: "The board could not complete this request. Please try again." });
  }
}

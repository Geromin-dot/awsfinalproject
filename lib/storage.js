import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { samplePosts } from "./board";

export const mode = () => process.env.BOARD_STORAGE || "preview";
const directory = () => process.env.BOARD_DATA_DIR || join(process.cwd(), ".board-data");
const filename = () => join(directory(), "board.json");
const run = promisify(execFile);
const table = () => process.env.BOARD_TABLE;
const bucket = () => process.env.BOARD_BUCKET;

function readLocal() {
  if (existsSync(filename())) return JSON.parse(readFileSync(filename(), "utf8"));
  return { posts: samplePosts.map((post) => ({ ...post, revision: 1 })), attachments: {} };
}

function saveLocal(state) {
  mkdirSync(directory(), { recursive: true });
  const temporary = join(directory(), randomUUID() + ".tmp");
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, filename());
}

async function aws(...args) {
  const { stdout } = await run("aws", [...args, "--output", "json", "--no-cli-pager"], {
    timeout: 20000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  return stdout.trim() ? JSON.parse(stdout) : {};
}

async function withTemporaryFile(useFile) {
  const temporary = await mkdtemp(join(tmpdir(), "board-"));
  try {
    return await useFile(join(temporary, "attachment.pdf"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function listPosts() {
  if (mode() === "preview") return samplePosts;
  if (mode() === "local") return readLocal().posts;
  const result = await aws("dynamodb", "scan", "--table-name", table(), "--consistent-read");
  return result.Items.map((item) => JSON.parse(item.payload.S));
}

export class Conflict extends Error {}

export async function savePost(post, previous, pdf) {
  if (mode() === "local") {
    const state = readLocal();
    const current = state.posts.find((item) => item.id === post.id);
    if (current?.revision !== previous?.revision) throw new Conflict();
    state.posts = [...state.posts.filter((item) => item.id !== post.id), post];
    if (pdf) state.attachments[post.attachment.key] = pdf.toString("base64");
    if (previous?.attachment && previous.attachment.key !== post.attachment?.key) {
      delete state.attachments[previous.attachment.key];
    }
    saveLocal(state);
    return;
  }

  if (pdf) {
    await withTemporaryFile(async (path) => {
      await writeFile(path, pdf);
      await aws("s3api", "put-object", "--bucket", bucket(), "--key", post.attachment.key,
        "--body", path, "--content-type", "application/pdf");
    });
  }
  try {
    const condition = previous
      ? ["--condition-expression", "revision = :previous", "--expression-attribute-values",
        JSON.stringify({ ":previous": { N: String(previous.revision) } })]
      : ["--condition-expression", "attribute_not_exists(id)"];
    await aws("dynamodb", "put-item", "--table-name", table(), "--item", JSON.stringify({
      id: { S: post.id }, revision: { N: String(post.revision) }, payload: { S: JSON.stringify(post) },
    }), ...condition);
  } catch (error) {
    if (!error.stderr?.includes("ConditionalCheckFailedException")) throw error;
    if (pdf) await deleteAttachment(post.attachment);
    throw new Conflict();
  }
  if (previous?.attachment?.key !== post.attachment?.key) await deleteAttachment(previous?.attachment);
}

async function deleteAttachment(attachment) {
  if (!attachment) return;
  try {
    await aws("s3api", "delete-object", "--bucket", bucket(), "--key", attachment.key);
  } catch (error) {
    console.error("Could not remove an unlinked attachment:", error.code);
  }
}

export async function deletePost(post) {
  if (mode() === "local") {
    const state = readLocal();
    const current = state.posts.find((item) => item.id === post.id);
    if (current?.revision !== post.revision) throw new Conflict();
    state.posts = state.posts.filter((item) => item.id !== post.id);
    if (post.attachment) delete state.attachments[post.attachment.key];
    saveLocal(state);
    return;
  }
  try {
    await aws("dynamodb", "delete-item", "--table-name", table(), "--key", JSON.stringify({ id: { S: post.id } }),
      "--condition-expression", "revision = :previous", "--expression-attribute-values",
      JSON.stringify({ ":previous": { N: String(post.revision) } }));
  } catch (error) {
    if (error.stderr?.includes("ConditionalCheckFailedException")) throw new Conflict();
    throw error;
  }
  await deleteAttachment(post.attachment);
}

export async function download(attachment) {
  if (mode() === "local") {
    const encoded = readLocal().attachments[attachment.key];
    return encoded ? Buffer.from(encoded, "base64") : null;
  }
  return withTemporaryFile(async (path) => {
    await aws("s3api", "get-object", "--bucket", bucket(), "--key", attachment.key, path);
    return readFile(path);
  });
}

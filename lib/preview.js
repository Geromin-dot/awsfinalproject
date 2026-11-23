import { categories, samplePosts, sortPosts } from "./board.js";

const key = "class-announcement-board:v2";
const oldKey = "class-announcement-board:v1";

export function previewBoard() {
  const saved = localStorage.getItem(key);
  const oldPosts = JSON.parse(localStorage.getItem(oldKey) || "[]");
  const posts = saved ? JSON.parse(saved) : [
    ...samplePosts,
    ...(Array.isArray(oldPosts) ? oldPosts.filter((post) => post?.id && post.title && post.message)
      .map((post) => ({ ...post, category: "General", pinned: false, createdAt: new Date().toISOString() })) : []),
  ].map((post) => ({ ...post, revision: 1 }));
  return { mode: "preview", teacher: true, posts: sortPosts(posts) };
}

export function updatePreview(body) {
  const { posts } = previewBoard();
  const previous = posts.find((post) => post.id === body.id);
  if (body.id && previous?.revision !== body.revision) {
    throw new Error("This announcement changed. Refresh the board and try again.");
  }

  let post;
  if (body.action === "pin") {
    post = { ...previous, pinned: !previous.pinned, revision: previous.revision + 1 };
  } else if (body.action === "save") {
    const title = body.title.trim();
    const message = body.message.trim();
    if (!title || title.length > 100 || !message || message.length > 2000 || !categories.includes(body.category)) {
      throw new Error("Enter a category, a title of 1–100 characters, and a message of 1–2,000 characters.");
    }
    if (body.file && (!/\.pdf$/i.test(body.file.name) || !atob(body.file.data.slice(0, 8)).startsWith("%PDF-"))) {
      throw new Error("Choose a PDF file up to 2 MB.");
    }
    post = {
      id: previous?.id || crypto.randomUUID(),
      createdAt: previous?.createdAt || new Date().toISOString(),
      title,
      message,
      category: body.category,
      pinned: body.pinned,
      attachment: body.file || (body.removeAttachment ? null : previous?.attachment || null),
      revision: (previous?.revision || 0) + 1,
    };
  }

  const updated = posts.filter((item) => item.id !== body.id);
  if (post) updated.push(post);
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    throw new Error("The browser could not save this change. Try a smaller attachment or remove an older attachment.");
  }
  return { mode: "preview", teacher: true, posts: sortPosts(updated) };
}

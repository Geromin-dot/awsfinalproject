import Head from "next/head";
import { useEffect, useState } from "react";

const STORAGE_KEY = "class-announcement-board:v1";
const POST_LIMIT = 30;
const REMINDER = "CLASS REMINDER\n\nCheck the board before class for schedule changes and assignment deadlines.\nBring your laptop or notebook to the next group activity.\n";
const REMINDER_URL = "data:text/plain;charset=utf-8," + encodeURIComponent(REMINDER);

export default function ClassAnnouncementBoard() {
  const [posts, setPosts] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setPosts(saved);
    } catch {
      setFeedback("Saved announcements could not be loaded.");
    }
    setReady(true);
  }, []);

  function publish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = fields.get("title").trim();
    const message = fields.get("message").trim();

    if (!title || !message || title.length > 80 || message.length > 500) {
      setFeedback("Enter a title of 1–80 characters and a message of 1–500 characters.");
      return;
    }

    const post = { id: window.crypto.randomUUID(), title, message };
    const updated = [post, ...posts].slice(0, POST_LIMIT);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPosts(updated);
      form.reset();
      setFeedback("Announcement posted.");
    } catch {
      setFeedback("The announcement could not be saved in this browser.");
    }
  }

  return (
    <>
      <Head>
        <title>Class Announcement Board</title>
        <meta name="description" content="Post and view class announcements." />
      </Head>
      <header className="masthead">
        <div className="wrap">
          <h1>Class Announcement Board</h1>
          <p>Preview · Posts are saved in this browser.</p>
        </div>
      </header>
      <main className="wrap columns">
        <section className="card" aria-labelledby="post-title">
          <h2 id="post-title">Post an announcement</h2>
          <form onSubmit={publish}>
            <label htmlFor="title">Title</label>
            <input id="title" name="title" maxLength={80} required />
            <label htmlFor="message">Message</label>
            <textarea id="message" name="message" maxLength={500} rows={4} required />
            <button type="submit" disabled={!ready}>Post announcement</button>
            <p className="feedback" role="status">{feedback}</p>
          </form>
          <a className="download" href={REMINDER_URL} download="class-reminder.txt">Download class reminder (.txt)</a>
        </section>
        <section aria-labelledby="recent-title">
          <h2 id="recent-title">Recent announcements</h2>
          {posts.length === 0 && <p className="card empty">No announcements yet.</p>}
          {posts.map((post) => (
            <article className="card announcement" key={post.id}>
              <h3>{post.title}</h3>
              <p>{post.message}</p>
            </article>
          ))}
        </section>
      </main>
      <style jsx global>{`
        :root { color-scheme: light; font-family: system-ui, sans-serif; color: #18243a; background: #f5f7fb; }
        * { box-sizing: border-box; }
        body { margin: 0; line-height: 1.5; }
        .wrap { width: min(940px, calc(100% - 40px)); margin-inline: auto; }
        .masthead { color: #fff; background: #132646; padding: 34px 0; }
        h1 { font-size: clamp(1.65rem, 5vw, 2.5rem); letter-spacing: -0.04em; margin: 0; }
        .masthead p { margin: 4px 0 0; color: #d3dff2; }
        .columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); align-items: start; gap: 28px; padding-block: 28px; }
        .card { background: #fff; border: 1px solid #dce3ee; border-radius: 12px; padding: 18px; }
        h2 { font-size: 1.2rem; margin: 0 0 14px; }
        h3 { font-size: 1.05rem; margin: 0 0 4px; overflow-wrap: anywhere; }
        .announcement, .empty { margin: 0 0 10px; }
        .announcement p { color: #40506a; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        form { display: grid; gap: 8px; }
        label { font-weight: 600; }
        input, textarea { min-width: 0; font: inherit; color: inherit; border: 1px solid #8190a5; border-radius: 6px; padding: 8px 10px; }
        textarea { resize: vertical; }
        button { justify-self: start; margin-top: 6px; border: 0; border-radius: 6px; padding: 9px 14px; color: #fff; background: #1d4ed8; font: inherit; font-weight: 600; cursor: pointer; }
        button:disabled { opacity: 0.65; cursor: wait; }
        button:hover:enabled { background: #173fab; }
        .feedback { margin: 0; color: #40506a; }
        .feedback:empty { display: none; }
        .download { display: inline-block; margin-top: 17px; color: #1948bd; }
        :focus-visible { outline: 3px solid #225de0; outline-offset: 3px; }
        @media (max-width: 690px) { .columns { grid-template-columns: 1fr; gap: 22px; } }
      `}</style>
    </>
  );
}

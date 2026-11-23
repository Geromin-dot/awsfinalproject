import Head from "next/head";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { categories, samplePosts, sortPosts } from "../lib/board";
import { previewBoard, updatePreview } from "../lib/preview";
import styles from "../styles/Board.module.css";

const emptyPost = { title: "", message: "", category: "General", pinned: false, dueDate: "" };
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

const savedKey = "class-announcement-board:saved";
const manilaDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila" });

function deadlineLabel(date) {
  return dateFormat.format(new Date(date + "T00:00:00+08:00"));
}

async function boardRequest(body) {
  const response = await fetch("/api/board", body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result.split(",")[1] });
    reader.onerror = () => reject(new Error("The attachment could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function ClassAnnouncementBoard() {
  const [board, setBoard] = useState({ posts: sortPosts(samplePosts), mode: "", teacher: false });
  const [view, setView] = useState("students");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState([]);
  const [today, setToday] = useState("");
  const [draft, setDraft] = useState(emptyPost);
  const [attachment, setAttachment] = useState(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [fileInput, setFileInput] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    setToday(manilaDay.format(new Date()));
    try {
      const stored = JSON.parse(localStorage.getItem(savedKey) || "[]");
      if (Array.isArray(stored)) setSaved(stored);
    } catch {
      setSaved([]);
    }
    boardRequest().then((result) => { if (active) setBoard(result.mode === "preview" ? previewBoard() : result); })
      .catch(() => {
        if (active) {
          setBoard({ posts: [], mode: "", teacher: false });
          setNotice({ error: true, text: "Could not load the board. Refresh the page to try again." });
        }
      });
    return () => { active = false; };
  }, []);

  function openView(nextView) {
    setView(nextView);
    setNotice(null);
    setConfirmDelete(null);
  }

  function edit(post = emptyPost) {
    setDraft(post);
    setAttachment(null);
    setRemoveAttachment(false);
    setFileInput((value) => value + 1);
  }

  async function change(getBody, success, onSuccess) {
    setBusy(true);
    setNotice(null);
    try {
      const body = await getBody();
      if (board.mode === "preview") {
        setBoard(updatePreview(body));
      } else {
        await boardRequest(body);
        setBoard(await boardRequest());
      }
      onSuccess?.();
      setNotice({ text: success });
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    change(() => ({ action: "login", password }), "Signed in.", () => form.reset());
  }

  function save(event) {
    event.preventDefault();
    change(async () => {
      if (attachment?.size > 2 * 1024 * 1024) throw new Error("Choose a PDF file up to 2 MB.");
      return {
        action: "save", id: draft.id, revision: draft.revision, title: draft.title, message: draft.message,
        category: draft.category, pinned: draft.pinned, dueDate: draft.dueDate || "", removeAttachment,
        file: attachment ? await encodeFile(attachment) : null,
      };
    }, draft.id ? "Announcement updated." : "Announcement published.", () => edit());
  }

  function toggleSaved(id) {
    const updated = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    try {
      localStorage.setItem(savedKey, JSON.stringify(updated));
      setSaved(updated);
    } catch {
      setNotice({ error: true, text: "This browser could not save your bookmark." });
    }
  }

  const search = query.trim().toLowerCase();
  const visible = board.posts.filter((post) => (category === "All" || post.category === category)
    && (!savedOnly || saved.includes(post.id))
    && [post.title, post.message, post.attachment?.name].some((field) => field?.toLowerCase().includes(search)));
  const upcoming = today ? board.posts.filter((post) => post.dueDate && post.dueDate >= today)
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate)).slice(0, 5) : [];
  const teacherView = view === "teacher";

  function postCard(post, manage = false) {
    return (
      <article id={manage ? undefined : "post-" + post.id} className={styles.post} data-pinned={post.pinned} key={post.id}>
        <div className={styles.meta}>
          <span className={styles.category} data-category={post.category}>{post.category}</span>
          {post.pinned && <span className={styles.pin}>Pinned</span>}
          <time dateTime={post.createdAt}>{dateFormat.format(new Date(post.createdAt))}</time>
        </div>
        <h3>{post.title}</h3>
        <p>{post.message}</p>
        {post.dueDate && <p className={styles.deadline}>Due <time dateTime={post.dueDate}>{deadlineLabel(post.dueDate)}</time></p>}
        {post.attachment && <a className={styles.attachment} href={post.attachment.data ? "data:application/pdf;base64," + post.attachment.data
          : "/api/board?download=" + encodeURIComponent(post.id)} download={post.attachment.name}>
          Download {post.attachment.name}
        </a>}
        {!manage && <div className={styles.actions}>
          <button type="button" aria-pressed={saved.includes(post.id)} onClick={() => toggleSaved(post.id)}>
            {saved.includes(post.id) ? "Saved" : "Save for later"}
          </button>
        </div>}
        {manage && (
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => edit(post)}>Edit</button>
            <button type="button" disabled={busy} onClick={() => change(
              () => ({ action: "pin", id: post.id, revision: post.revision }),
              post.pinned ? "Announcement unpinned." : "Announcement pinned.")}>{post.pinned ? "Unpin" : "Pin"}</button>
            {confirmDelete === post.id ? (
              <>
                <button type="button" className={styles.danger} disabled={busy} onClick={() => change(
                  () => ({ action: "delete", id: post.id, revision: post.revision }), "Announcement deleted.", () => {
                    setConfirmDelete(null);
                    if (draft.id === post.id) edit();
                  })}>Confirm delete</button>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(null)}>Cancel</button>
              </>
            ) : <button type="button" className={styles.danger} disabled={busy} onClick={() => setConfirmDelete(post.id)}>Delete</button>}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className={styles.shell}>
      <Head>
        <title>Class Board</title>
        <meta name="description" content="Class announcements, deadlines, and files." />
      </Head>
      <header className={styles.header}>
        <div className={styles.wrap + " " + styles.headerRow}>
          <button className={styles.brand} onClick={() => openView("students")}>
            <span aria-hidden="true" className={styles.mark}>▤</span> Class Board
          </button>
          <nav aria-label="Board views" className={styles.nav}>
            <button aria-current={!teacherView ? "page" : undefined} onClick={() => openView("students")}>Student board</button>
            <button aria-current={teacherView ? "page" : undefined} onClick={() => openView("teacher")}>Teacher dashboard</button>
          </nav>
        </div>
      </header>

      <main className={styles.wrap}>
        <section className={styles.hero}>
          <div>
            <h1>{teacherView ? "Teacher dashboard" : "Class announcements"}</h1>
            <p>{teacherView ? "Publish class updates and keep important announcements at the top."
              : "Class updates, deadlines, and files in one place."}</p>
          </div>
          {teacherView && board.mode === "aws" && board.teacher && <button className={styles.signout} disabled={busy} onClick={() =>
            change(() => ({ action: "logout" }), "Signed out.", () => edit())}>Sign out</button>}
        </section>

        {notice && <p className={styles.notice} role={notice.error ? "alert" : "status"} data-error={Boolean(notice.error)}>{notice.text}</p>}
        {!teacherView && (
          <div className={styles.studentLayout}>
            <section className={styles.feed} aria-labelledby="announcements">
              <div className={styles.feedHeader}>
                <h2 id="announcements">Announcements</h2>
                {["preview", "local"].includes(board.mode) && <span className={styles.demo}>
                  {board.mode === "preview" ? "Browser demo · Changes saved on this device" : "Local demo"}
                </span>}
              </div>
              <label className={styles.searchLabel} htmlFor="announcement-search">Search announcements</label>
              <input className={styles.search} id="announcement-search" type="search" placeholder="Search titles, messages, or files"
                value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className={styles.filters} aria-label="Filter by category">
                {["All", ...categories].map((item) => (
                  <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
                ))}
                <button aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Saved only</button>
              </div>
              {visible.length ? visible.map((post) => postCard(post)) : <p className={styles.empty}>{savedOnly ? "No saved announcements match these filters." : "No announcements match these filters."}</p>}
            </section>
            <aside className={styles.panel + " " + styles.upcoming} aria-labelledby="upcoming">
              <h2 id="upcoming">Upcoming deadlines</h2>
              {upcoming.length ? (
                <ul>
                  {upcoming.map((post) => (
                    <li key={post.id}>
                      <time dateTime={post.dueDate}>{post.dueDate === today ? "Today" : deadlineLabel(post.dueDate)}</time>
                      <a href={"#post-" + post.id} onClick={() => flushSync(() => {
                        setQuery("");
                        setCategory("All");
                        setSavedOnly(false);
                      })}>{post.title}</a>
                    </li>
                  ))}
                </ul>
              ) : <p>No upcoming deadlines.</p>}
            </aside>
          </div>
        )}

        {teacherView && board.mode === "preview" && (
          <p className={styles.notice}>Demo changes stay in this browser.</p>
        )}

        {teacherView && board.mode === "aws" && !board.teacher && (
          <form className={styles.panel + " " + styles.login} onSubmit={signIn}>
            <h2>Teacher sign-in</h2>
            <label htmlFor="password">Teacher password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
            <button className={styles.primary} disabled={busy}>Sign in</button>
          </form>
        )}

        {teacherView && board.teacher && (
          <div className={styles.dashboard}>
            <form className={styles.panel + " " + styles.editor} onSubmit={save}>
              <h2>{draft.id ? "Edit announcement" : "New announcement"}</h2>
              <fieldset disabled={busy}>
                <label htmlFor="title">Title</label>
                <input id="title" required maxLength={100} value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                <label htmlFor="category">Category</label>
                <select id="category" value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
                <label htmlFor="message">Message</label>
                <textarea id="message" required maxLength={2000} rows={5} value={draft.message}
                  onChange={(event) => setDraft({ ...draft, message: event.target.value })} />
                <label htmlFor="due-date">Deadline <span>(optional)</span></label>
                <input id="due-date" type="date" min="0001-01-01" max="9999-12-31" value={draft.dueDate || ""}
                  onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
                <label htmlFor="file">PDF attachment <span>(optional, up to 2 MB)</span></label>
                <input key={fileInput} id="file" type="file" accept="application/pdf,.pdf"
                  onChange={(event) => setAttachment(event.target.files[0] || null)} />
                {draft.attachment && !attachment && <label className={styles.check}>
                  <input type="checkbox" checked={removeAttachment}
                    onChange={(event) => setRemoveAttachment(event.target.checked)} /> Remove {draft.attachment.name}
                </label>}
                <label className={styles.check}>
                  <input type="checkbox" checked={draft.pinned}
                    onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} /> Pin to top
                </label>
                <div className={styles.formActions}>
                  <button className={styles.primary}>{draft.id ? "Save changes" : "Publish announcement"}</button>
                  {draft.id && <button type="button" className={styles.secondary} onClick={() => edit()}>Cancel edit</button>}
                </div>
              </fieldset>
            </form>
            <section aria-labelledby="published">
              <h2 id="published">Published announcements</h2>
              {board.posts.length ? board.posts.map((post) => postCard(post, true)) : <p className={styles.empty}>No announcements yet.</p>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

import { useState } from "react";
import { categories } from "../lib/board";
import styles from "../styles/Board.module.css";

const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

function exportPosts(posts) {
  function cell(value) {
    const text = String(value ?? "");
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }

  const rows = [
    ["Title", "Category", "Published", "Deadline", "Pinned", "Attachment"],
    ...posts.map((post) => [
      post.title, post.category, post.createdAt, post.dueDate, post.pinned ? "Yes" : "No", post.attachment?.name,
    ]),
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "class-board-announcements.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminConsole({ posts, busy, confirmDelete, setConfirmDelete, onModerate }) {
  const [category, setCategory] = useState("All");
  const visible = category === "All" ? posts : posts.filter((post) => post.category === category);
  const metrics = [
    ["Published", posts.length],
    ["Pinned", posts.filter((post) => post.pinned).length],
    ["With deadlines", posts.filter((post) => post.dueDate).length],
    ["With PDFs", posts.filter((post) => post.attachment).length],
  ];

  return (
    <div className={styles.admin}>
      <section aria-label="Board overview" className={styles.metrics}>
        {metrics.map(([label, value]) => (
          <div className={styles.metric} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section aria-labelledby="moderation" className={styles.panel + " " + styles.moderation}>
        <div className={styles.moderationHeader}>
          <h2 id="moderation">Moderate announcements</h2>
          <div className={styles.adminTools}>
            <select aria-label="Filter moderation by category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {["All", ...categories].map((item) => <option key={item} value={item}>{item === "All" ? "All categories" : item}</option>)}
            </select>
            <button className={styles.secondary} type="button" disabled={!posts.length} onClick={() => exportPosts(posts)}>
              Export CSV
            </button>
          </div>
        </div>
        {visible.length ? (
          <div className={styles.tableScroll} role="region" aria-label="Announcement moderation table" tabIndex={0}>
            <table>
              <thead>
                <tr><th scope="col">Announcement</th><th scope="col">Published</th><th scope="col">Actions</th></tr>
              </thead>
              <tbody>
                {visible.map((post) => (
                  <tr key={post.id}>
                    <th scope="row">
                      <strong>{post.title}</strong>
                      <div className={styles.tableMeta}>
                        <span className={styles.category} data-category={post.category}>{post.category}</span>
                        {post.pinned && <span className={styles.pin}>Pinned</span>}
                      </div>
                    </th>
                    <td><time dateTime={post.createdAt}>{date.format(new Date(post.createdAt))}</time></td>
                    <td>
                      <div className={styles.actions}>
                        {confirmDelete === post.id ? (
                          <>
                            <button type="button" className={styles.danger} disabled={busy} onClick={() => onModerate("delete", post)}>
                              Confirm removal
                            </button>
                            <button type="button" disabled={busy} onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={busy} onClick={() => onModerate("pin", post)}>{post.pinned ? "Unpin" : "Pin"}</button>
                            <button type="button" className={styles.danger} disabled={busy} onClick={() => setConfirmDelete(post.id)}>Remove</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className={styles.empty}>No announcements in this category.</p>}
      </section>
    </div>
  );
}

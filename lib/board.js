export const categories = ["General", "Assignments", "Exams", "Events"];

export const samplePosts = [
  { id: "sample-exam", title: "Midterm exam schedule", category: "Exams", pinned: true,
    message: "The Cloud Architecting midterm is on Friday at 10:00 AM in Lab 2. Arrive 15 minutes early and bring your student ID.",
    dueDate: "2026-11-27", createdAt: "2026-11-23T08:00:00Z" },
  { id: "sample-project", title: "Cloud project progress check", category: "Assignments", pinned: false,
    message: "Bring your working prototype and be ready to explain where your app, data, and files will live.",
    dueDate: "2026-11-30", createdAt: "2026-11-22T08:00:00Z" },
  { id: "sample-lab", title: "Open lab consultation", category: "Events", pinned: false,
    message: "Lab 2 is open Wednesday from 1:00 to 3:00 PM for group consultations.",
    createdAt: "2026-11-20T08:00:00Z" },
];

export function sortPosts(posts) {
  return [...posts].sort((first, second) => Number(second.pinned) - Number(first.pinned)
    || second.createdAt.localeCompare(first.createdAt));
}

export function validDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

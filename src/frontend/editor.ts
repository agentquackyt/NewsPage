import { marked } from "marked";
import type { ArticleMeta } from "../types";

// === Frontmatter helpers ===

interface FM {
  id: string;
  title: string;
  date: string;
  description: string;
  thumbnail: string;
  extra: [string, string][]; // any additional YAML lines preserved verbatim
}

function parseFrontmatter(raw: string): { fm: FM; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const emptyFm: FM = { id: "", title: "", date: "", description: "", thumbnail: "", extra: [] };
  if (!match) return { fm: emptyFm, body: raw };

  const known = new Set(["id", "title", "date", "description", "thumbnail"]);
  const fm: FM = { ...emptyFm, extra: [] };
  for (const line of (match[1] ?? "").split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === "id") fm.id = value;
    else if (key === "title") fm.title = value;
    else if (key === "date") fm.date = value;
    else if (key === "description") fm.description = value;
    else if (key === "thumbnail") fm.thumbnail = value;
    else if (known.has(key) === false) fm.extra.push([key, value]);
  }
  return { fm, body: match[2] ?? "" };
}

function serializeFrontmatter(fm: FM, body: string): string {
  const quoteIfNeeded = (v: string) =>
    /[:#\[\]{},&*?|>!'"@%`]/.test(v) ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : v;

  let yaml = "---\n";
  if (fm.id) yaml += `id: ${fm.id}\n`;
  if (fm.title) yaml += `title: ${quoteIfNeeded(fm.title)}\n`;
  if (fm.date) yaml += `date: ${fm.date}\n`;
  if (fm.description) yaml += `description: ${quoteIfNeeded(fm.description)}\n`;
  if (fm.thumbnail) yaml += `thumbnail: ${quoteIfNeeded(fm.thumbnail)}\n`;
  for (const [k, v] of fm.extra) yaml += `${k}: ${quoteIfNeeded(v)}\n`;
  yaml += "---\n\n";
  return yaml + body.replace(/^\n+/, "");
}

// === State ===
let articles: ArticleMeta[] = [];
let currentId: string | null = null;
let isDirty = false;

// === DOM refs ===
const articleList    = document.getElementById("article-list")    as HTMLUListElement;
const editorToolbar  = document.getElementById("editor-toolbar")  as HTMLDivElement;
const editorLeft     = document.getElementById("editor-left")     as HTMLDivElement;
const mdEditor       = document.getElementById("md-editor")       as HTMLTextAreaElement;
const previewPanel   = document.getElementById("preview-panel")   as HTMLDivElement;
const emptyState     = document.getElementById("empty-state")     as HTMLDivElement;
const currentTitleEl = document.getElementById("current-title")   as HTMLSpanElement;
const statusBar      = document.getElementById("status-bar")      as HTMLDivElement;
const modalOverlay   = document.getElementById("modal-overlay")   as HTMLDivElement;
const modalTitleInput = document.getElementById("modal-title")    as HTMLInputElement;
const modalDescInput  = document.getElementById("modal-desc")     as HTMLInputElement;

// Frontmatter form inputs
const fmId   = document.getElementById("fm-id")          as HTMLInputElement;
const fmTitle = document.getElementById("fm-title")      as HTMLInputElement;
const fmDate  = document.getElementById("fm-date")       as HTMLInputElement;
const fmDesc  = document.getElementById("fm-description") as HTMLInputElement;
const fmThumbnail = document.getElementById("fm-thumbnail") as HTMLInputElement;

// Extra YAML lines that aren't in the form — preserved on save
let fmExtra: [string, string][] = [];

// === Helpers ===

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function setStatus(msg: string, duration = 3000): void {
  statusBar.textContent = msg;
  if (duration > 0) setTimeout(() => (statusBar.textContent = "Ready"), duration);
}

function getFM(): FM {
  return { id: fmId.value, title: fmTitle.value, date: fmDate.value, description: fmDesc.value, thumbnail: fmThumbnail.value, extra: fmExtra };
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// === Article loading ===

async function loadArticles(): Promise<void> {
  const res = await fetch("/api/articles");
  articles = (await res.json()) as ArticleMeta[];
  renderList();
}

function renderList(): void {
  articleList.innerHTML = "";
  for (const a of articles) {
    const li = document.createElement("li");
    li.dataset["id"] = a.id;
    if (a.id === currentId) li.classList.add("active");
    li.innerHTML = `<div class="item-title">${a.title}</div><div class="item-date">${a.date}</div>`;
    li.addEventListener("click", () => openArticle(a.id));
    articleList.appendChild(li);
  }
}

async function openArticle(id: string): Promise<void> {
  if (isDirty && !confirm("Discard unsaved changes?")) return;
  isDirty = false;

  currentId = id;
  const res = await fetch(`/api/articles/${encodeURIComponent(id)}`);
  const { content } = (await res.json()) as { content: string };

  const { fm, body } = parseFrontmatter(content);
  fmId.value    = fm.id;
  fmTitle.value = fm.title;
  fmDate.value  = fm.date;
  fmDesc.value  = fm.description;
  fmThumbnail.value = fm.thumbnail;
  fmExtra       = fm.extra;
  mdEditor.value = body;

  editorToolbar.style.display = "flex";
  emptyState.style.display    = "none";
  editorLeft.style.display    = "flex";
  previewPanel.style.display  = "block";

  await updatePreview();
  currentTitleEl.textContent = fm.title || id;

  renderList();
}

// === Preview ===

async function updatePreview(): Promise<void> {
  const fm = getFM();
  const bodyHtml = String(await marked(mdEditor.value));

  const headerSection = `
    <div class="preview-fm-header">
      <div class="pfm-badge">Article metadata</div>
      ${fm.thumbnail ? `<img src="${fm.thumbnail}" style="width:100%;max-height:200px;object-fit:cover;margin:1rem 0;border-radius:4px" />` : ""}
      <div class="pfm-title">${fm.title || "<em>untitled</em>"}</div>
      ${fm.date ? `<div class="pfm-date">${formatDateDisplay(fm.date)}</div>` : ""}
      ${fm.description ? `<p class="pfm-desc">${fm.description}</p>` : ""}
    </div>
  `;
  previewPanel.innerHTML = headerSection + `<div class="preview-body">${bodyHtml}</div>`;
}

// === Save / Delete / Create ===

async function saveArticle(): Promise<void> {
  if (!currentId) return;
  const full = serializeFrontmatter(getFM(), mdEditor.value);
  const res = await fetch(`/api/articles/${encodeURIComponent(currentId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: full }),
  });
  if (res.ok) {
    isDirty = false;
    currentTitleEl.textContent = fmTitle.value || currentId;
    setStatus("Saved ✓");
    await loadArticles();
  } else {
    setStatus("Save failed ✗", 0);
  }
}

async function deleteArticle(): Promise<void> {
  if (!currentId) return;
  if (!confirm(`Delete article "${currentId}"? This cannot be undone.`)) return;
  const res = await fetch(`/api/articles/${encodeURIComponent(currentId)}`, { method: "DELETE" });
  if (res.ok) {
    currentId = null;
    isDirty = false;
    editorToolbar.style.display = "none";
    editorLeft.style.display    = "none";
    previewPanel.style.display  = "none";
    emptyState.style.display    = "flex";
    setStatus("Article deleted");
    await loadArticles();
  } else {
    setStatus("Delete failed ✗", 0);
  }
}

async function createArticle(title: string, description: string): Promise<void> {
  const res = await fetch("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  if (res.ok) {
    const { id } = (await res.json()) as { id: string };
    await loadArticles();
    await openArticle(id);
    setStatus("Article created ✓");
  } else {
    setStatus("Create failed ✗", 0);
  }
}

async function rebuildSite(): Promise<void> {
  setStatus("Rebuilding…", 0);
  const res = await fetch("/api/generate", { method: "POST" });
  if (res.ok) {
    setStatus("Site rebuilt ✓");
  } else {
    const { error } = (await res.json()) as { error: string };
    setStatus(`Rebuild failed: ${error}`, 0);
  }
}

// === Event wiring ===

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  setStatus("Uploading…", 0);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    setStatus("Upload failed ✗", 3000);
    throw new Error("Upload failed");
  }
  const data = (await res.json()) as { url: string };
  setStatus("Uploaded ✓");
  return data.url;
}

const markDirtyAndPreview = () => { isDirty = true; updatePreview(); };
mdEditor.addEventListener("input", markDirtyAndPreview);
fmTitle.addEventListener("input", () => {
  fmId.value = slugify(fmTitle.value);
  markDirtyAndPreview();
});
for (const el of [fmDate, fmDesc, fmThumbnail]) {
  el.addEventListener("input", markDirtyAndPreview);
}

// Image uploads
const btnUploadThumb = document.getElementById("btn-upload-thumb")!;
const fileUploadThumb = document.getElementById("file-upload-thumb") as HTMLInputElement;

btnUploadThumb.addEventListener("click", () => fileUploadThumb.click());
fileUploadThumb.addEventListener("change", async () => {
  const file = fileUploadThumb.files?.[0];
  if (!file) return;
  try {
    const url = await uploadFile(file);
    fmThumbnail.value = url;
    markDirtyAndPreview();
  } catch {}
  fileUploadThumb.value = "";
});

const btnUploadImg = document.getElementById("btn-upload-img")!;
const fileUploadImg = document.getElementById("file-upload-img") as HTMLInputElement;

btnUploadImg.addEventListener("click", () => fileUploadImg.click());
fileUploadImg.addEventListener("change", async () => {
  const file = fileUploadImg.files?.[0];
  if (!file) return;
  try {
    const url = await uploadFile(file);
    const start = mdEditor.selectionStart;
    const end = mdEditor.selectionEnd;
    const text = `![${file.name}](${url})`;
    mdEditor.value = mdEditor.value.substring(0, start) + text + mdEditor.value.substring(end);
    mdEditor.selectionStart = mdEditor.selectionEnd = start + text.length;
    mdEditor.focus();
    markDirtyAndPreview();
  } catch {}
  fileUploadImg.value = "";
});

document.getElementById("btn-save")!.addEventListener("click", saveArticle);
document.getElementById("btn-delete")!.addEventListener("click", deleteArticle);
document.getElementById("btn-rebuild")!.addEventListener("click", rebuildSite);
document.getElementById("btn-new")!.addEventListener("click", () => {
  modalTitleInput.value = "";
  modalDescInput.value  = "";
  modalOverlay.classList.add("open");
  modalTitleInput.focus();
});
document.getElementById("modal-cancel")!.addEventListener("click", () => modalOverlay.classList.remove("open"));
document.getElementById("modal-confirm")!.addEventListener("click", async () => {
  const title = modalTitleInput.value.trim();
  if (!title) return;
  modalOverlay.classList.remove("open");
  await createArticle(title, modalDescInput.value.trim());
});
modalTitleInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter") (document.getElementById("modal-confirm") as HTMLButtonElement).click();
  if (e.key === "Escape") modalOverlay.classList.remove("open");
});
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveArticle();
  }
});

loadArticles();


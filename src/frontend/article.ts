import { marked } from "marked";
import type { ArticleMeta } from "../types";

interface SiteConfig {
  title: string;
  theme: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Strip YAML frontmatter from markdown before rendering
function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n?/, "");
}

async function main(): Promise<void> {
  const container = document.getElementById("article-page")!;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    container.innerHTML = '<p class="loading-msg">No article ID specified.</p>';
    return;
  }

  try {
    const [articles, config] = await Promise.all([
      fetchJson<ArticleMeta[]>("./articles.json"),
      fetchJson<SiteConfig>("./config.json"),
    ]);

    const meta = articles.find((a) => a.id === id);
    if (!meta) {
      container.innerHTML = `<p class="loading-msg">Article "${id}" not found.</p>`;
      return;
    }

    // Update page title
    document.title = `${meta.title} — ${config.title}`;

    const rawMarkdown = await fetchText(`./articles/${meta.filename}`);
    const bodyMd = stripFrontmatter(rawMarkdown);
    const bodyHtml = await marked(bodyMd);

    const bannerHtml = meta.thumbnail
      ? `<div class="article-banner"><img src="${meta.thumbnail}" alt="" /></div>`
      : "";

    container.innerHTML = `
      ${bannerHtml}
      <div class="article-header">
        <div class="article-date">${formatDate(meta.date)}</div>
        <h1 class="article-title">${meta.title}</h1>
        ${meta.description ? `<p class="article-description">${meta.description}</p>` : ""}
      </div>
      <div class="article-body">${bodyHtml}</div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="loading-msg">Error: ${(err as Error).message}</p>`;
  }
}

main();

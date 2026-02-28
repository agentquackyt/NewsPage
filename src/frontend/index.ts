import type { ArticleMeta } from "../types";

interface SiteConfig {
  title: string;
  theme: string;
  description: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderCard(article: ArticleMeta): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "article-card";
  a.href = `./article.html?id=${encodeURIComponent(article.id)}`;
  
  const thumbHtml = article.thumbnail
    ? `<div class="card-thumb"><img src="${article.thumbnail}" alt="" loading="lazy" /></div>`
    : "";

  a.innerHTML = `
    ${thumbHtml}
    <div class="card-content">
      <div class="card-date">${formatDate(article.date)}</div>
      <h2 class="card-title">${article.title}</h2>
      ${article.description ? `<p class="card-desc">${article.description}</p>` : ""}
    </div>
  `;
  return a;
}

async function main(): Promise<void> {
  const grid = document.getElementById("article-grid")!;

  try {
    const [articles] = await Promise.all([
      fetchJson<ArticleMeta[]>("./articles.json"),
      fetchJson<SiteConfig>("./config.json"),
    ]);

    grid.innerHTML = "";

    if (articles.length === 0) {
      grid.innerHTML = '<p class="loading-msg">No articles yet.</p>';
      return;
    }

    for (const article of articles) {
      grid.appendChild(renderCard(article));
    }
  } catch (err) {
    grid.innerHTML = `<p class="loading-msg">Error loading articles: ${(err as Error).message}</p>`;
  }
}

main();

import { join, basename } from "path";
import matter from "gray-matter";
import type { ArticleMeta } from "../types";

export const ARTICLES_DIR = "articles";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function getArticleFiles(cwd = process.cwd()): Promise<string[]> {
  const dir = join(cwd, ARTICLES_DIR);
  const glob = new Bun.Glob("*.md");
  const files: string[] = [];
  for await (const file of glob.scan({ cwd: dir })) {
    files.push(file);
  }
  return files.sort();
}

export async function parseArticle(filename: string, cwd = process.cwd()): Promise<ArticleMeta> {
  const filePath = join(cwd, ARTICLES_DIR, filename);
  const content = await Bun.file(filePath).text();
  const { data } = matter(content);

  const id = (data["id"] as string | undefined) ?? slugify(basename(filename, ".md"));
  const title = (data["title"] as string | undefined) ?? id;
  // gray-matter parses bare YAML dates as Date objects; coerce to ISO string
  const rawDate = data["date"];
  const date =
    rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : typeof rawDate === "string"
      ? rawDate
      : new Date().toISOString().slice(0, 10);
  const description = (data["description"] as string | undefined) ?? "";
  const thumbnail = data["thumbnail"] as string | undefined;

  return { id, title, date, description, thumbnail, filename };
}

export async function buildArticleList(cwd = process.cwd()): Promise<ArticleMeta[]> {
  const files = await getArticleFiles(cwd);
  const articles = await Promise.all(files.map((f) => parseArticle(f, cwd)));
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveArticleList(articles: ArticleMeta[], outputDir: string): Promise<void> {
  const dest = join(outputDir, "articles.json");
  await Bun.write(dest, JSON.stringify(articles, null, 2));
}

export function generateFrontmatter(title: string, description = ""): string {
  const id = slugify(title);
  const date = new Date().toISOString().slice(0, 10);
  return `---\nid: ${id}\ntitle: "${title}"\ndate: ${date}\ndescription: "${description}"\n---\n\n# ${title}\n\nWrite your article here...\n`;
}

export function slugify2(text: string): string {
  return slugify(text);
}

import { join } from "path";
import { rm } from "fs/promises";
import matter from "gray-matter";
import {
  getArticleFiles,
  buildArticleList,
  generateFrontmatter,
  slugify2,
  ARTICLES_DIR,
} from "../lib/articles";
import { ask, success, error, info, CYAN, DIM, BOLD, RESET } from "../lib/ui";

const ROOT = process.cwd();

async function refresh(): Promise<void> {
  const articles = await buildArticleList(ROOT);
  process.stdout.write(`${BOLD}Refreshed ${articles.length} article(s):${RESET}\n`);
  for (const a of articles) {
    info(`${DIM}[${a.date}]${RESET} ${CYAN}${a.title}${RESET}  ${DIM}(${a.filename})${RESET}`);
  }
}

async function add(articleId?: string): Promise<void> {
  let title: string;

  if (articleId) {
    title = articleId.includes("-") ? articleId.replace(/-/g, " ") : articleId;
  } else {
    title = await ask("Article title: ");
  }

  if (!title) {
    error("Title cannot be empty.");
    process.exit(1);
  }

  const slug = slugify2(title);
  const filename = `${slug}.md`;
  const filePath = join(ROOT, ARTICLES_DIR, filename);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    error(`Article already exists: ${filename}`);
    process.exit(1);
  }

  await import("fs/promises").then(({ mkdir }) => mkdir(join(ROOT, ARTICLES_DIR), { recursive: true }));

  const content = generateFrontmatter(title);
  await Bun.write(filePath, content);
  success(`Created: articles/${filename}`);
}

async function remove(articleId?: string): Promise<void> {
  if (!articleId) {
    error("Usage: newspage articles remove <articleId>");
    process.exit(1);
  }

  const files = await getArticleFiles(ROOT);

  let matched: string | undefined;
  for (const f of files) {
    if (f === `${articleId}.md` || f === articleId) {
      matched = f;
      break;
    }
    const text = await Bun.file(join(ROOT, ARTICLES_DIR, f)).text();
    const { data } = matter(text);
    if ((data["id"] as string | undefined) === articleId) {
      matched = f;
      break;
    }
  }

  if (!matched) {
    error(`Article not found: ${articleId}`);
    process.exit(1);
  }

  await rm(join(ROOT, ARTICLES_DIR, matched));
  success(`Removed: articles/${matched}`);
}

export async function articles(action: string, articleId?: string): Promise<void> {
  switch (action) {
    case "refresh":
      await refresh();
      break;
    case "add":
      await add(articleId);
      break;
    case "remove":
      await remove(articleId);
      break;
    default:
      error(`Unknown action: ${action}. Use: refresh | add | remove`);
      process.exit(1);
  }
}

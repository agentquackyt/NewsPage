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

const ROOT = process.cwd();

async function refresh(): Promise<void> {
  const articles = await buildArticleList(ROOT);
  console.log(`Refreshed ${articles.length} article(s):`);
  for (const a of articles) {
    console.log(`  [${a.date}] ${a.title}  (${a.filename})`);
  }
}

async function add(articleId?: string): Promise<void> {
  let title: string;

  if (articleId) {
    // Treat provided id as the title if it contains spaces, else use as slug
    title = articleId.includes("-") ? articleId.replace(/-/g, " ") : articleId;
  } else {
    // Prompt for title
    process.stdout.write("Article title: ");
    title = (await new Promise<string>((resolve) => {
      let input = "";
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (chunk) => {
        input = (chunk as string).trim();
        process.stdin.pause();
        resolve(input);
      });
    }));
  }

  if (!title) {
    console.error("Title cannot be empty.");
    process.exit(1);
  }

  const slug = slugify2(title);
  const filename = `${slug}.md`;
  const filePath = join(ROOT, ARTICLES_DIR, filename);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    console.error(`Article already exists: ${filename}`);
    process.exit(1);
  }

  // ensure the directory exists before writing
  await import("fs/promises").then(({ mkdir }) => mkdir(join(ROOT, ARTICLES_DIR), { recursive: true }));

  const content = generateFrontmatter(title);
  await Bun.write(filePath, content);
  console.log(`Created: articles/${filename}`);
}

async function remove(articleId?: string): Promise<void> {
  if (!articleId) {
    console.error("Usage: newspage articles remove <articleId>");
    process.exit(1);
  }

  const files = await getArticleFiles(ROOT);
  const target = files.find((f) => {
    const content = Bun.file(join(ROOT, ARTICLES_DIR, f));
    return f === `${articleId}.md` || f === articleId;
  });

  // Also search by id frontmatter
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
    console.error(`Article not found: ${articleId}`);
    process.exit(1);
  }

  await rm(join(ROOT, ARTICLES_DIR, matched));
  console.log(`Removed: articles/${matched}`);
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
      console.error(`Unknown action: ${action}. Use: refresh | add | remove`);
      process.exit(1);
  }
}

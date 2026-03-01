import { join, dirname } from "path";
import { cp, mkdir } from "fs/promises";
import { buildArticleList, saveArticleList, ARTICLES_DIR } from "./articles";
import { loadConfig } from "./config";
import { INSTALL_SRC } from "./env";

async function copyFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, Bun.file(src));
}

async function processHtml(template: string, replacements: Record<string, string>): Promise<string> {
  let html = await Bun.file(template).text();
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

export async function buildSite(outputDir: string, cwd = process.cwd()): Promise<void> {
  const config = await loadConfig(cwd);
  const articles = await buildArticleList(cwd);

  await mkdir(outputDir, { recursive: true });

  // Bundle frontend scripts with Bun.build
  const result = await Bun.build({
    entrypoints: [
      join(INSTALL_SRC, "frontend", "index.ts"),
      join(INSTALL_SRC, "frontend", "article.ts"),
    ],
    outdir: join(outputDir, "js"),
    minify: true,
    target: "browser",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Frontend build failed");
  }

  // Process and write HTML templates
  const replacements: Record<string, string> = {
    SITE_TITLE: config.title,
    SITE_DESCRIPTION: config.description,
    THEME: config.theme,
  };

  const indexHtml = await processHtml(join(INSTALL_SRC, "index.html"), replacements);
  await Bun.write(join(outputDir, "index.html"), indexHtml);

  const articleHtml = await processHtml(join(INSTALL_SRC, "article.html"), replacements);
  await Bun.write(join(outputDir, "article.html"), articleHtml);

  // Copy CSS themes
  await copyFile(join(INSTALL_SRC, "themes", "guardian.css"), join(outputDir, "themes", "guardian.css"));
  await copyFile(join(INSTALL_SRC, "themes", "times.css"), join(outputDir, "themes", "times.css"));
  await copyFile(join(INSTALL_SRC, "themes", "tagesschau.css"), join(outputDir, "themes", "tagesschau.css"));
  await copyFile(join(INSTALL_SRC, "themes", "tech.css"), join(outputDir, "themes", "tech.css"));

  // Copy uploads directory for images
  try {
    await cp(join(cwd, "uploads"), join(outputDir, "uploads"), { recursive: true });
  } catch (err) {
    // Ignore if uploads directory doesn't exist
  }

  // Write site config for the frontend
  await Bun.write(
    join(outputDir, "config.json"),
    JSON.stringify({ title: config.title, theme: config.theme, description: config.description }, null, 2)
  );

  // Write articles.json
  await saveArticleList(articles, outputDir);

  // Copy article markdown files
  const articlesOutDir = join(outputDir, ARTICLES_DIR);
  await mkdir(articlesOutDir, { recursive: true });
  for (const article of articles) {
    await copyFile(join(cwd, ARTICLES_DIR, article.filename), join(articlesOutDir, article.filename));
  }

  console.log(`✓ Built ${articles.length} article(s) → ${outputDir}`);
}

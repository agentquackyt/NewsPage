import { join } from "path";
import { mkdir } from "fs/promises";
import { buildSite } from "../lib/build";
import {
  buildArticleList,
  generateFrontmatter,
  slugify2,
  ARTICLES_DIR,
} from "../lib/articles";
import matter from "gray-matter";

const ROOT = process.cwd();
const DIST = join(ROOT, ".newspage-dist");
const PORT = 5000;

async function rebuildDist(): Promise<void> {
  await buildSite(DIST, ROOT);
}

async function serveEditorBundle(): Promise<Response> {
  // Build the editor bundle on demand
  const result = await Bun.build({
    entrypoints: [join(ROOT, "src", "frontend", "editor.ts")],
    outdir: DIST,
    naming: "editor-bundle.js",
    target: "browser",
    minify: false,
  });
  if (!result.success) throw new Error("Editor bundle build failed");
  return new Response(await Bun.file(join(DIST, "editor-bundle.js")).text(), {
    headers: { "Content-Type": "application/javascript" },
  });
}

async function handleApiRequest(req: Request, url: URL): Promise<Response> {
  const pathSegments = url.pathname.replace("/api/", "").split("/");
  const resource = pathSegments[0];

  // GET /api/articles
  if (resource === "articles" && req.method === "GET" && pathSegments.length === 1) {
    const list = await buildArticleList(ROOT);
    return Response.json(list);
  }

  // GET /api/articles/:id
  if (resource === "articles" && req.method === "GET" && pathSegments.length === 2) {
    const id = decodeURIComponent(pathSegments[1] ?? "");
    const list = await buildArticleList(ROOT);
    const meta = list.find((a) => a.id === id);
    if (!meta) return Response.json({ error: "Not found" }, { status: 404 });
    const content = await Bun.file(join(ROOT, ARTICLES_DIR, meta.filename)).text();
    return Response.json({ content });
  }

  // PUT /api/articles/:id — save content
  if (resource === "articles" && req.method === "PUT" && pathSegments.length === 2) {
    const id = decodeURIComponent(pathSegments[1] ?? "");
    const list = await buildArticleList(ROOT);
    const meta = list.find((a) => a.id === id);
    if (!meta) return Response.json({ error: "Not found" }, { status: 404 });
    const { content } = (await req.json()) as { content: string };
    await Bun.write(join(ROOT, ARTICLES_DIR, meta.filename), content);
    return Response.json({ ok: true });
  }

  // POST /api/articles — create new
  if (resource === "articles" && req.method === "POST" && pathSegments.length === 1) {
    const { title, description } = (await req.json()) as { title: string; description?: string };
    if (!title) return Response.json({ error: "title required" }, { status: 400 });
    const id = slugify2(title);
    const filename = `${id}.md`;
    const filePath = join(ROOT, ARTICLES_DIR, filename);
    await Bun.write(filePath, generateFrontmatter(title, description ?? ""));
    return Response.json({ id });
  }

  // DELETE /api/articles/:id
  if (resource === "articles" && req.method === "DELETE" && pathSegments.length === 2) {
    const id = decodeURIComponent(pathSegments[1] ?? "");
    const list = await buildArticleList(ROOT);
    const meta = list.find((a) => a.id === id);
    if (!meta) return Response.json({ error: "Not found" }, { status: 404 });
    const { rm } = await import("fs/promises");
    await rm(join(ROOT, ARTICLES_DIR, meta.filename));
    return Response.json({ ok: true });
  }

  // POST /api/generate — rebuild
  if (resource === "generate" && req.method === "POST") {
    try {
      await rebuildDist();
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // POST /api/upload
  if (resource === "upload" && req.method === "POST") {
    try {
      const fd = await req.formData();
      const file = fd.get("file") as File;
      if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
      
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
      const filename = `${crypto.randomUUID()}${ext}`;
      const outdir = join(ROOT, "uploads");
      
      await mkdir(outdir, { recursive: true });
      await Bun.write(join(outdir, filename), file);
      
      return Response.json({ url: `/uploads/${filename}` });
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

async function serveStaticFile(pathname: string): Promise<Response> {
  const filePath = join(DIST, pathname.startsWith("/") ? pathname.slice(1) : pathname);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(file);
}

export async function serve(): Promise<void> {
  // Initial build
  console.log("Building site…");
  await mkdir(DIST, { recursive: true });
  try {
    await rebuildDist();
  } catch (err) {
    console.warn("Initial build failed (continuing anyway):", (err as Error).message);
  }

  const editorHtml = await Bun.file(join(ROOT, "src", "editor.html")).text();
  // Build editor bundle once at startup
  await Bun.build({
    entrypoints: [join(ROOT, "src", "frontend", "editor.ts")],
    outdir: DIST,
    naming: "editor-bundle.js",
    target: "browser",
    minify: false,
  });

  console.log(`\nServer running:`);
  console.log(`  Site:   http://localhost:${PORT}/`);
  console.log(`  Editor: http://localhost:${PORT}/editor`);

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;

      // Editor bundle JS
      if (pathname === "/editor-bundle.js") {
        const f = Bun.file(join(DIST, "editor-bundle.js"));
        return new Response(f, { headers: { "Content-Type": "application/javascript" } });
      }

      // Editor SPA
      if (pathname === "/editor" || pathname === "/editor/") {
        return new Response(editorHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // API routes
      if (pathname.startsWith("/api/")) {
        return handleApiRequest(req, url);
      }

      // Serve uploaded files directly from source during dev
      if (pathname.startsWith("/uploads/")) {
        const f = Bun.file(join(ROOT, pathname.slice(1)));
        if (await f.exists()) return new Response(f);
      }

      // Default: serve article markdown files from source (so the editor works on latest content)
      if (pathname.startsWith("/articles/") && pathname.endsWith(".md")) {
        const f = Bun.file(join(ROOT, pathname.slice(1)));
        if (await f.exists()) return new Response(f);
      }

      // Serve generated static files
      const cleanPath = pathname === "/" ? "index.html" : pathname.slice(1);
      return serveStaticFile(cleanPath);
    },
  });
}

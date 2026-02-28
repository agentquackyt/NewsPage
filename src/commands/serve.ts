import { join } from "path";
import { mkdir } from "fs/promises";
import { buildSite } from "../lib/build";
import {
  buildArticleList,
  generateFrontmatter,
  extractUploadedImages,
  slugify2,
  ARTICLES_DIR,
} from "../lib/articles";
import matter from "gray-matter";

const ROOT = process.cwd();
const DIST = join(ROOT, ".newspage-dist");
const PORT = 3000;

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
    let list: Awaited<ReturnType<typeof buildArticleList>>;
    try {
      list = await buildArticleList(ROOT);
    } catch (err) {
      // if the articles directory doesn't exist or something else goes wrong,
      // return an empty array rather than propagating the error to the client
      console.warn("Error building article list:", (err as Error).message);
      list = [];
    }
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
    // ensure the articles directory exists before attempting to write
    await mkdir(join(ROOT, ARTICLES_DIR), { recursive: true });
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

    // Collect all /uploads/ paths used by the other articles so we don't delete
    // images that are still referenced elsewhere.
    const otherContent = await Promise.all(
      list
        .filter((a) => a.id !== id)
        .map((a) => Bun.file(join(ROOT, ARTICLES_DIR, a.filename)).text())
    );
    const stillUsed = new Set(otherContent.flatMap(extractUploadedImages));

    // Read the article being deleted and find its image references.
    const content = await Bun.file(join(ROOT, ARTICLES_DIR, meta.filename)).text();
    const toDelete = extractUploadedImages(content).filter((p) => !stillUsed.has(p));

    // Delete the article file first.
    await rm(join(ROOT, ARTICLES_DIR, meta.filename));

    // Then remove orphaned upload files (ignore errors for missing files).
    await Promise.all(
      toDelete.map((urlPath) =>
        rm(join(ROOT, urlPath.slice(1))).catch(() => {})
      )
    );

    return Response.json({ ok: true, deletedImages: toDelete.length });
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

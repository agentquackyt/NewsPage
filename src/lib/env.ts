import { join, dirname } from "path";
import { existsSync } from "fs";

/**
 * Resolves the directory that contains the installed `src/` folder.
 *
 * - Production (compiled exe): the exe lives next to `src/`, so we look
 *   at `dirname(process.execPath)`.
 * - Development (`bun run cli.ts`): `process.execPath` is the bun binary,
 *   which won't have a `src/` sibling, so we fall back to the project root
 *   derived from this file's own location (`src/lib/env.ts` → two levels up).
 */
function resolveInstallDir(): string {
  const nextToExe = dirname(process.execPath);
  if (existsSync(join(nextToExe, "src"))) {
    return nextToExe;
  }
  // Development fallback: this file is at src/lib/env.ts
  return join(import.meta.dir, "..", "..");
}

/** Root of the installation — where `src/` with templates and themes lives. */
export const INSTALL_DIR = resolveInstallDir();

/** Absolute path to the `src/` directory that ships with the installation. */
export const INSTALL_SRC = join(INSTALL_DIR, "src");

import { resolve } from "path";
import { buildSite } from "../lib/build";
import { success, error, info, DIM, RESET } from "../lib/ui";

export async function generate(outputPath: string): Promise<void> {
  const dest = resolve(outputPath);
  info(`Generating site ${DIM}→${RESET} ${dest}`);
  try {
    await buildSite(dest);
    success("Build complete.");
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

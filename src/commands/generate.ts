import { resolve } from "path";
import { buildSite } from "../lib/build";

export async function generate(outputPath: string): Promise<void> {
  const dest = resolve(outputPath);
  console.log(`Generating site → ${dest}`);
  try {
    await buildSite(dest);
    console.log("Done.");
  } catch (err) {
    console.error("Build failed:", (err as Error).message);
    process.exit(1);
  }
}

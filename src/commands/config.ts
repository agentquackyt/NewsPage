import { loadConfig, saveConfig } from "../lib/config";
import type { SiteConfig } from "../types";

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve((chunk as string).trim());
    });
  });
}

function pickOrDefault(input: string, fallback: string): string {
  return input.length > 0 ? input : fallback;
}

export async function config(): Promise<void> {
  const current = await loadConfig();

  console.log("\n── NewsPage Config Wizard ──");
  console.log("Press Enter to keep the current value.\n");

  const title = pickOrDefault(
    await ask(`Site title [${current.title}]: `),
    current.title
  );

  const description = pickOrDefault(
    await ask(`Site description [${current.description}]: `),
    current.description
  );

  let theme = current.theme;
  const themeInput = await ask(`Theme (guardian | times | tagesschau) [${current.theme}]: `);
  if (themeInput === "guardian" || themeInput === "times" || themeInput === "tagesschau") {
    theme = themeInput as any;
  } else if (themeInput.length > 0) {
    console.warn(`Unknown theme "${themeInput}", keeping "${current.theme}".`);
  }

  const newConfig: SiteConfig = { title, description, theme };
  await saveConfig(newConfig);

  console.log("\n✓ Config saved to newspage.config.json");
  console.log(JSON.stringify(newConfig, null, 2));
}

import { loadConfig, saveConfig } from "../lib/config";
import type { SiteConfig } from "../types";
import { join } from "path";
import { readdir } from "node:fs/promises";
import {
  ask,
  pickOrDefault,
  selectFromList,
  header,
  hint,
  success,
  warn,
  RESET,
} from "../lib/ui";

export async function config(): Promise<void> {
  const current = await loadConfig();

  header("NewsPage Config Wizard");
  hint("Press Enter to keep the current value.\n");

  const title = pickOrDefault(
    await ask(`Site title [${current.title}]: `),
    current.title
  );

  const description = pickOrDefault(
    await ask(`Site description [${current.description}]: `),
    current.description
  );

  let availableThemes: string[] = [];
  try {
    const themesDir = join(__dirname, "..", "themes");
    const files = await readdir(themesDir);
    availableThemes = files
      .filter((file) => file.endsWith(".css"))
      .map((file) => file.replace(".css", ""));
  } catch {
    availableThemes = ["guardian", "times", "tagesschau", "tech"];
  }

  process.stdout.write(RESET + "\n");
  const theme = await selectFromList(
    "Select theme (↑/↓, Enter to confirm):",
    availableThemes,
    current.theme
  );

  const newConfig: SiteConfig = { title, description, theme };
  await saveConfig(newConfig);

  success("Config saved to newspage.config.json");
  process.stdout.write(JSON.stringify(newConfig, null, 2) + "\n");
}


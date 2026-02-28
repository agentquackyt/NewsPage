import { join } from "path";
import type { SiteConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

export const CONFIG_FILE = "newspage.config.json";

export async function loadConfig(cwd = process.cwd()): Promise<SiteConfig> {
  const configPath = join(cwd, CONFIG_FILE);
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    return (await file.json()) as SiteConfig;
  } catch {
    console.warn("Failed to parse config file, using defaults.");
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: SiteConfig, cwd = process.cwd()): Promise<void> {
  const configPath = join(cwd, CONFIG_FILE);
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

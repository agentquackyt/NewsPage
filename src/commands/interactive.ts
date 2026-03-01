import { generate } from "./generate";
import { articles } from "./articles";
import { serve } from "./serve";
import { config } from "./config";
import {
  ask,
  selectFromList,
  header,
  hint,
  success,
  error,
  info,
  RESET,
} from "../lib/ui";

// ── sub-handlers ─────────────────────────────────────────────────────────────

async function handleGenerate(): Promise<void> {
  header("Build Static Site");
  const path = await ask("Output path [dist]: ");
  await generate(path.length > 0 ? path : "dist");
}

async function handleArticles(): Promise<void> {
  const BACK = "← Back";
  const choice = await selectFromList(
    "Articles — select action (↑/↓, Enter):",
    ["List / refresh articles", "Add article", "Remove article", BACK],
    "List / refresh articles"
  );

  switch (choice) {
    case "List / refresh articles":
      await articles("refresh");
      break;

    case "Add article": {
      process.stdout.write(RESET + "\n");
      const title = await ask("Article title: ");
      if (!title) { error("Title cannot be empty."); break; }
      await articles("add", title);
      break;
    }

    case "Remove article": {
      process.stdout.write(RESET + "\n");
      const id = await ask("Article id to remove: ");
      if (!id) { error("Id cannot be empty."); break; }
      await articles("remove", id);
      break;
    }

    case BACK:
    default:
      break;
  }
}

// ── main loop ─────────────────────────────────────────────────────────────────

export async function interactive(): Promise<void> {
  header("NewsPage CLI");
  hint("No command specified — interactive mode.\n");

  const EXIT = "Exit";

  while (true) {
    process.stdout.write(RESET + "\n");
    const choice = await selectFromList(
      "What would you like to do? (↑/↓, Enter):",
      [
        "Start dev server",
        "Build static site",
        "Manage articles",
        "Configure site",
        EXIT,
      ],
      "Start dev server"
    );

    switch (choice) {
      case "Start dev server":
        header("Dev Server");
        info("Starting server… (Ctrl+C to stop)\n");
        await serve();
        await new Promise(() => {});
        return;

      case "Build static site":
        await handleGenerate();
        break;

      case "Manage articles":
        await handleArticles();
        break;

      case "Configure site":
        await config();
        break;

      case EXIT:
        success("Bye!");
        process.exit(0);
    }
  }
}


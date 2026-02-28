import { generate } from "./generate";
import { articles } from "./articles";
import { serve } from "./serve";
import { config } from "./config";

// ── readline helper ──────────────────────────────────────────────────────────

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

// ── menus ────────────────────────────────────────────────────────────────────

function printMainMenu(): void {
  console.log("\n╔══════════════════════════════╗");
  console.log("║       NewsPage  CLI          ║");
  console.log("╠══════════════════════════════╣");
  console.log("║  1  Start dev server         ║");
  console.log("║  2  Build static site        ║");
  console.log("║  3  Manage articles          ║");
  console.log("║  4  Configure site           ║");
  console.log("║  0  Exit                     ║");
  console.log("╚══════════════════════════════╝");
}

function printArticlesMenu(): void {
  console.log("\n── Articles ──────────────────────");
  console.log("  1  List / refresh articles");
  console.log("  2  Add article");
  console.log("  3  Remove article");
  console.log("  0  Back");
  console.log("──────────────────────────────────");
}

// ── sub-handlers ─────────────────────────────────────────────────────────────

async function handleGenerate(): Promise<void> {
  const path = await ask("Output path [dist]: ");
  await generate(path.length > 0 ? path : "dist");
}

async function handleArticles(): Promise<void> {
  printArticlesMenu();
  const choice = await ask("Choice: ");

  switch (choice) {
    case "1":
      await articles("refresh");
      break;
    case "2": {
      const title = await ask("Article title: ");
      if (!title) { console.error("Title cannot be empty."); break; }
      await articles("add", title);
      break;
    }
    case "3": {
      const id = await ask("Article id to remove: ");
      if (!id) { console.error("Id cannot be empty."); break; }
      await articles("remove", id);
      break;
    }
    case "0":
      break;
    default:
      console.log("Unknown choice.");
  }
}

// ── main loop ─────────────────────────────────────────────────────────────────

export async function interactive(): Promise<void> {
  console.log("\nWelcome to NewsPage! No command specified — launching interactive mode.");

  while (true) {
    printMainMenu();
    const choice = await ask("Choice: ");

    switch (choice) {
      case "1":
        console.log("\nStarting dev server… (Ctrl+C to stop)\n");
        await serve();
        // Bun.serve() is non-blocking; park here forever so the process stays
        // alive and process.exit(0) in cli.ts is never reached.
        await new Promise(() => {});
        return;

      case "2":
        await handleGenerate();
        break;

      case "3":
        await handleArticles();
        break;

      case "4":
        await config();
        break;

      case "0":
      case "":
        console.log("Bye!");
        process.exit(0);

      default:
        console.log(`Unknown choice "${choice}".`);
    }
  }
}

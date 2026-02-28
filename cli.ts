#!/usr/bin/env bun

import { Command } from "commander";
import { generate } from "./src/commands/generate";
import { articles } from "./src/commands/articles";
import { serve } from "./src/commands/serve";
import { config } from "./src/commands/config";
import { interactive } from "./src/commands/interactive";

const program = new Command();

program
  .name("newspage")
  .description("CLI for generating and managing a dynamic, frontend-only news page")
  .version("1.0.0");

program
  .command("generate <path>")
  .description("Generate the static site into <path> using Bun.build")
  .action(generate);

program
  .command("articles <action> [articleId]")
  .description(
    "Manage articles.\n" +
    "  refresh           — list and refresh articles.json metadata\n" +
    "  add [articleId]   — create a new markdown article\n" +
    "  remove <articleId>— delete an article by id"
  )
  .action(articles);

program
  .command("serve")
  .description(
    "Serve the generated site on http://localhost:5000\n" +
    "Editor UI available at http://localhost:5000/editor"
  )
  .action(serve);

program
  .command("config")
  .description("Start the interactive configuration wizard (saves newspage.config.json)")
  .action(config);

// If no sub-command is provided, launch the interactive menu.
if (process.argv.length <= 2) {
  await interactive();
  process.exit(0);
}

program.parse(process.argv);

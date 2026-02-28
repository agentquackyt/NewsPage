#!/usr/bin/env bun
// implement a cli which has following commands:
// generate <path>
// articles <refresh|add|remove> <?articleId>
// serve - Serves the generated site on localhost:3000 as well as an editor site which is not in the generated site but allows editing the articles and regenerating the site on demand. The editor site should be available at localhost:3000/editor
// config - starts a config wizard

import { Command } from "commander";
import { generate } from "./src/commands/generate";
import { articles } from "./src/commands/articles";
import { serve } from "./src/commands/serve";
import { config } from "./src/commands/config";

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

program.parse(process.argv);

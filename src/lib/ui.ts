// ── ANSI helpers ──────────────────────────────────────────────────────────────

export const RESET  = "\x1b[0m";
export const BOLD   = "\x1b[1m";
export const DIM    = "\x1b[2m";
export const CYAN   = "\x1b[36m";
export const LIME   = "\x1b[32;1m";
export const RED    = "\x1b[31;1m";
export const YELLOW = "\x1b[33;1m";

export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";

/** Erase from top of screen and reset colours. */
export const CLEAR_SCREEN = "\x1B[1J\x1B[0m";

// ── Primitives ────────────────────────────────────────────────────────────────

/** Print a top-level section header in lime/bold. */
export function header(text: string): void {
  process.stdout.write(`${LIME}${BOLD}\n── ${text} ──${RESET}\n`);
}

/** Print a dim hint line. */
export function hint(text: string): void {
  process.stdout.write(`${DIM}${text}${RESET}\n`);
}

/** Print a success line in lime. */
export function success(text: string): void {
  process.stdout.write(`${LIME}✓ ${text}${RESET}\n`);
}

/** Print an error line in red. */
export function error(text: string): void {
  process.stdout.write(`${RED}✗ ${text}${RESET}\n`);
}

/** Print a warning line in yellow. */
export function warn(text: string): void {
  process.stdout.write(`${YELLOW}⚠ ${text}${RESET}\n`);
}

/** Print an info bullet in cyan. */
export function info(text: string): void {
  process.stdout.write(`${CYAN}  ${text}${RESET}\n`);
}

// ── Input helpers ─────────────────────────────────────────────────────────────

/** Prompt for a single line of text. Question is bold; typed text is cyan. */
export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${RESET}${BOLD}${question}${RESET}${CYAN}`);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      process.stdout.write(RESET);
      resolve((chunk as string).trim());
    });
  });
}

/** Return `input` if non-empty, otherwise `fallback`. */
export function pickOrDefault(input: string, fallback: string): string {
  return input.length > 0 ? input : fallback;
}

/**
 * Interactive arrow-key list picker.
 * Renders in-place, hides the cursor while active, restores on exit.
 */
export function selectFromList(
  label: string,
  items: string[],
  defaultItem: string
): Promise<string> {
  return new Promise((resolve) => {
    let index = Math.max(0, items.indexOf(defaultItem));

    function render() {
      if ((render as any)._drawn) {
        process.stdout.write(`\x1b[${items.length + 1}A`);
      }
      (render as any)._drawn = true;

      process.stdout.write(`${BOLD}${label}${RESET}\n`);
      for (let i = 0; i < items.length; i++) {
        if (i === index) {
          process.stdout.write(`  ${CYAN}${BOLD}> ${items[i]}${RESET}\n`);
        } else {
          process.stdout.write(`  ${DIM}  ${items[i]}${RESET}\n`);
        }
      }
    }

    process.stdout.write(HIDE_CURSOR);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function onKey(data: string) {
      if (data === "\x1b[A") {                       // Up
        index = (index - 1 + items.length) % items.length;
        render();
      } else if (data === "\x1b[B") {                // Down
        index = (index + 1) % items.length;
        render();
      } else if (data === "\r" || data === "\n") {   // Enter
        process.stdout.write(SHOW_CURSOR);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        process.stdout.write("\n");
        resolve(items[index] as string);
      } else if (data === "\x03") {                  // Ctrl+C
        process.stdout.write(SHOW_CURSOR);
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(0);
      }
    }

    process.stdin.on("data", onKey);
  });
}

// Strips ANSI/terminal control sequences from untrusted provider text before it is
// ever printed to a terminal — a model response can legally contain arbitrary bytes,
// and printing them raw risks terminal manipulation (screen clear, hidden text,
// cursor tricks). Applied to human-readable output only; --json output preserves the
// original text since it is never rendered by a terminal emulator.
//
// Control characters are built with String.fromCharCode (never a literal control byte
// or a \u escape in a string literal) so this file is unambiguous in any editor, diff
// viewer, or text-transport layer.
const ESC = String.fromCharCode(27); // starts every ANSI escape sequence
const BEL = String.fromCharCode(7); // terminates an OSC sequence in some terminals

// CSI sequences: ESC [ ... final-byte (cursor moves, colors, screen clear, etc.)
const CSI_PATTERN = new RegExp(ESC + "\\[[0-?]*[ -/]*[@-~]", "g");
// OSC sequences: ESC ] ... (ESC \\ | BEL) (window title, hyperlinks, clipboard writes)
const OSC_PATTERN = new RegExp(ESC + "\\][\\s\\S]*?(?:" + ESC + "\\\\|" + BEL + ")", "g");
// Any other two-byte ESC sequence not covered above.
const OTHER_ESCAPE_PATTERN = new RegExp(ESC + "[@-Z\\\\\\]^_]", "g");

// Remaining C0 control characters (codes 0-8, 11-31, 127), keeping tab (9) and newline (10).
function isDisallowedControlChar(code: number): boolean {
  if (code === 9 || code === 10) return false; // keep \t and \n
  if (code <= 31) return true; // C0 control range
  if (code === 127) return true; // DEL
  return false;
}

function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isDisallowedControlChar(code)) {
      out += ch;
    }
  }
  return out;
}

export function sanitizeForTerminal(text: string): string {
  const withoutEscapes = text
    .replace(OSC_PATTERN, "")
    .replace(CSI_PATTERN, "")
    .replace(OTHER_ESCAPE_PATTERN, "");
  return stripControlChars(withoutEscapes);
}

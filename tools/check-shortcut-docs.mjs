/*
 * Checks the built-in keyboard shortcuts against Microsoft's article.
 *
 * The panel's built-in lists (SETS in src/lib/shortcuts.js) are taken from
 * Microsoft's "Keyboard Shortcuts" article, and the panel links to it (DOCS).
 * This reads both straight from shortcuts.js, so there is no second copy to
 * keep up, and checks that:
 *
 *   - every key in SETS still appears in the article's Markdown source, which
 *     lives in the MicrosoftDocs/dynamics365smb-docs repository on GitHub;
 *   - every DOCS link still opens a page.
 *
 * A key that is found is only mentioned somewhere in the article, not proven
 * to do the same thing in the same place. A missing one means "go and look",
 * not "delete it": the article follows BC online, and an older on-premises BC
 * may still have the key.
 *
 * tests/run-tests.ps1 runs it after the test pages; on its own it is
 * `node tools/check-shortcut-docs.mjs`. Exit codes: 0 all found; 1 something
 * is missing or moved; 2 could not ask (offline, a server error), which the
 * runner reports without failing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SOURCE = 'https://raw.githubusercontent.com/MicrosoftDocs/dynamics365smb-docs/main/business-central/keyboard-shortcuts.md';
const SOURCE_PAGE = 'https://github.com/MicrosoftDocs/dynamics365smb-docs/blob/main/business-central/keyboard-shortcuts.md';
const TIMEOUT_MS = 30000;

// How the article spells a key that SETS writes shorter.
const SPELLING = { Down: 'Down arrow', Up: 'Up arrow', Left: 'Left arrow', Right: 'Right arrow' };

class Unreachable extends Error {}

/** SETS and DOCS, from the extension's own file. */
function loadShortcuts() {
  const file = fileURLToPath(new URL('../src/lib/shortcuts.js', import.meta.url));
  const sandbox = { self: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.self.BCBuddy.Shortcuts;
}

/**
 * Every key combination in the article, as comboId() writes it.
 * "<kbd>Ctrl</kbd>+<kbd>A</kbd>" and "<kbd>Ctrl+A</kbd>" are the same one.
 */
function articleCombos(markdown) {
  const text = markdown
    .replace(/\s+/g, ' ')
    .replace(/<kbd>\s*/gi, '<kbd>')
    .replace(/\s*<\/kbd>/gi, '</kbd>')
    .replace(/<\/kbd>\s*\+\s*<kbd>/gi, '+');
  const combos = new Set();
  for (const m of text.matchAll(/<kbd>([^<]+)<\/kbd>/gi)) combos.add(comboId(m[1].split('+')));
  return combos;
}

/**
 * One spelling for a combination, whatever the order of its modifiers:
 * ["Shift", "Alt", "Down"] -> "alt+down arrow+shift".
 */
function comboId(keys) {
  return keys.map((key) => (SPELLING[key.trim()] || key.trim()).toLowerCase()).sort().join('+');
}

async function get(url) {
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'bc-buddy-shortcut-docs-check' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (e) {
    throw new Unreachable(`${url}: ${e.message}`);
  }
  if (response.status >= 500 || response.status === 429) {
    throw new Unreachable(`${url}: HTTP ${response.status}`);
  }
  return response;
}

async function main() {
  const { SETS, DOCS, keyParts } = loadShortcuts();
  const lines = [];
  let failed = false;

  const source = await get(SOURCE);
  if (!source.ok) {
    failed = true;
    lines.push(`The article's source did not open (HTTP ${source.status}): ${SOURCE}`,
      'Microsoft may have moved or renamed it: put its new path in SOURCE in tools/check-shortcut-docs.mjs.');
  } else {
    const article = articleCombos(await source.text());
    const missing = [];
    let count = 0;
    for (const [set, [, rows]] of Object.entries(SETS)) {
      for (const [keys, text] of rows) {
        for (const alt of keyParts(keys)) {
          for (const combo of alt) {
            count++;
            if (!article.has(comboId(combo))) missing.push(`  ${combo.join('+')}  (${set}, ${text})`);
          }
        }
      }
    }
    if (missing.length) {
      failed = true;
      lines.push(`${missing.length} of ${count} keys in SETS (src/lib/shortcuts.js) are not in the article any more:`,
        ...missing,
        `Check what it says now: ${SOURCE_PAGE}`,
        'A key Microsoft dropped or replaced can go or get its new keys; one that is only spelled',
        'differently needs a line in SPELLING in tools/check-shortcut-docs.mjs.');
    } else {
      lines.push(`All ${count} keys in SETS are still in the article.`);
    }
  }

  for (const [, url] of DOCS) {
    const page = await get(url);
    if (!page.ok) {
      failed = true;
      lines.push(`The panel's link does not open (HTTP ${page.status}): ${url}`,
        'Update DOCS in src/lib/shortcuts.js and the check on it in tests/test-core.html.');
    } else {
      lines.push(`The panel's link opens: ${url}`);
    }
  }

  console.log(lines.join('\n'));
  return failed ? 1 : 0;
}

// Offline is said on stdout, which the runner prints. A bug in this script
// goes to stderr with its stack, and fails like a missing key.
main().then((code) => { process.exitCode = code; }, (e) => {
  if (e instanceof Unreachable) {
    console.log(`Could not ask: ${e.message}`);
    process.exitCode = 2;
  } else {
    console.error(e);
    process.exitCode = 1;
  }
});

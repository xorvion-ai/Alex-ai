// Pre-push guard: fails if anything personal is about to be committed.
//   node scripts/check-no-personal-data.mjs
// The repos are public, so account ids, private chat links, phone numbers and
// the local working-context file must never appear in tracked files.

import { execSync } from "node:child_process";
import fs from "node:fs";

const PATTERNS = [
  [/chatgpt\.com\/c\/[0-9a-f-]{8,}/i, "a private ChatGPT conversation link"],
  [/chat\.openai\.com\/c\/[0-9a-f-]{8,}/i, "a private ChatGPT conversation link"],
  [/sumitchoudhary\d*@|sumit@[a-z]+\.[a-z]+/i, "a personal email address"],
  [/sumitchoudhary\d*-org|project-\d{8}-[0-9a-f-]+/i, "a Google Cloud account/project id"],
  [/\+91[ -]?\d{4,5}[ -]?\d{4,6}/, "a real +91 phone number"],
  [/postgres(ql)?:\/\/[^\s:]+:[^\s@]+@[^\s/]+/i, "a real database URL"],
  [/AIza[0-9A-Za-z_-]{30,}|tvly-[0-9A-Za-z_-]{20,}/, "a real API key"],
];
// .env.example is documentation: its placeholders are meant to look like the
// real thing. Demo-seed numbers are deliberately fake.
const SKIP_FILES = [".env.example"];
const ALLOW = [/\+91 90000 00000/, /919000000000/]; // obvious demo placeholders

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !f.startsWith("node_modules/"));

if (tracked.includes("PROJECT-STATUS.md")) {
  console.error("FAIL: PROJECT-STATUS.md is tracked — it is local-only working context");
  process.exit(1);
}

let bad = 0;
for (const file of tracked) {
  if (SKIP_FILES.includes(file)) continue;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue; // binary or unreadable
  }
  for (const [re, what] of PATTERNS) {
    const m = text.match(re);
    if (m && !ALLOW.some((a) => a.test(m[0]))) {
      console.error(`FAIL: ${file} contains ${what}: ${m[0].slice(0, 40)}`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`clean: ${tracked.length} tracked files, no personal data`);

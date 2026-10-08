import { readdir, readFile } from "node:fs/promises";

const files = ["index.html", ...(await walk(new URL("../src/", import.meta.url)))];

const forbidden = [
  { pattern: /<button\b/i, reason: "buttons are not allowed" },
  { pattern: /<form\b/i, reason: "forms are not allowed" },
  { pattern: /\bonClick\s*=/i, reason: "click actions are not allowed" },
  { pattern: /localStorage/i, reason: "browser local storage is not allowed" },
  { pattern: /sessionStorage/i, reason: "browser session storage is not allowed" },
  { pattern: /document\.cookie/i, reason: "cookies are not allowed" },
  { pattern: /Authorization/i, reason: "authorization headers are not allowed" },
  { pattern: /https?:\/\//i, reason: "external network URLs are not allowed in app source" },
  { pattern: /WebSocket/i, reason: "WebSockets are not allowed" },
  { pattern: /EventSource/i, reason: "EventSource is not allowed" },
  { pattern: /sendBeacon/i, reason: "sendBeacon is not allowed" },
  { pattern: /window\.open/i, reason: "window.open is not allowed" },
];

for (const relative of files) {
  const url =
    relative === "index.html"
      ? new URL("../index.html", import.meta.url)
      : new URL("../src/" + relative, import.meta.url);

  const source = await readFile(url, "utf8");

  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      throw new Error("Read-only source guard failed in " + relative + ": " + rule.reason);
    }
  }

  const withoutAllowedSnapshotFetch = source.replace(
    /fetch\(\s*["']\.\/portfolio-snapshot\.json["']/g,
    "ALLOWED_SNAPSHOT_FETCH(",
  );

  if (/\bfetch\s*\(/.test(withoutAllowedSnapshotFetch)) {
    throw new Error("Read-only source guard failed in " + relative + ": unexpected fetch target");
  }
}

process.stdout.write("Read-only Overview source guard passed.\n");

async function walk(directoryUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      result.push(...(await walk(new URL(entry.name + "/", directoryUrl), relative + "/")));
      continue;
    }

    if (/\.(tsx?|jsx?|css)$/.test(entry.name)) result.push(relative);
  }

  return result;
}

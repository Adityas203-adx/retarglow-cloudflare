import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist"]);
const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      if (entry.name === "." || entry.name === "..") continue;
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    files.push(fullPath);
  }

  return files;
}

async function main() {
  const projectRoot = path.resolve(ROOT);
  const files = await collectFiles(projectRoot);

  if (files.length === 0) {
    console.log("No JavaScript files found to lint.");
    return;
  }

  let hasFailures = false;

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit"
    });

    if (result.status !== 0) {
      hasFailures = true;
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
    console.error("Lint failed: one or more files failed syntax validation.");
  } else {
    console.log(`Lint passed: ${files.length} files validated.`);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

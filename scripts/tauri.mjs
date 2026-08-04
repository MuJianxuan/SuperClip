#!/usr/bin/env node
// Thin wrapper around the Tauri CLI that supports a port offset for local dev.
//
// Why: `tauri dev` + Vite default to port 1420. When several Tauri apps are
// developed side by side they collide. Setting PORT_OFFSET (or passing the
// `--port-offset` flag to the dev subcommand) shifts both the Vite dev server
// (see vite.config.ts) and Tauri's build.devUrl to `1420 + offset`, so each
// app can pick a unique port without editing config files.
//
// Usage:
//   PORT_OFFSET=100 npm run tauri dev
//   npm run tauri dev -- --port-offset 100
//   npm run tauri dev -- --port-offset=100
//   npm run tauri dev -- --port-offset 100 -- <extra tauri dev args>
//
// Non-dev subcommands (`build`, `info`, ...) are forwarded unchanged.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 1420;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

// Locate the real Tauri CLI installed in node_modules.
function resolveTauriBinary() {
  // Prefer the JS entry of @tauri-apps/cli so it can be spawned deterministically with node.
  const jsEntry = resolve(repoRoot, "node_modules/@tauri-apps/cli/tauri.js");
  if (existsSync(jsEntry)) return jsEntry;
  // Fall back to the .bin shim (or PATH as a last resort).
  const shim = resolve(
    repoRoot,
    "node_modules/.bin/tauri" + (process.platform === "win32" ? ".cmd" : "")
  );
  if (existsSync(shim)) return shim;
  return "tauri";
}

function parseOffset(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n)) {
    console.warn(`[tauri] ignoring invalid port offset value: "${raw}"`);
    return undefined;
  }
  return n;
}

const argv = process.argv.slice(2);

// Split out our own `--port-offset` flag; everything else is forwarded to Tauri.
const tauriArgs = [];
let portOffsetArg;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--port-offset") {
    portOffsetArg = argv[i + 1];
    i++; // consume the value
    continue;
  }
  if (a.startsWith("--port-offset=")) {
    portOffsetArg = a.slice("--port-offset=".length);
    continue;
  }
  tauriArgs.push(a);
}

const envOffset = parseOffset(process.env.PORT_OFFSET);
const offset = parseOffset(portOffsetArg) ?? envOffset ?? 0;

// Only dev subcommands (dev, android dev, ios dev) consume build.devUrl.
const isDev =
  tauriArgs[0] === "dev" ||
  ((tauriArgs[0] === "android" || tauriArgs[0] === "ios") && tauriArgs[1] === "dev");

if (isDev && offset !== 0) {
  const port = DEFAULT_PORT + offset;
  if (port < 1 || port > 65535) {
    console.error(`[tauri] port ${port} is out of range (1-65535); aborting.`);
    process.exit(1);
  }
  // Override Tauri's build.devUrl so the Rust side loads the Vite server on the
  // shifted port. Must be inserted BEFORE any `--` separator, because everything
  // after `--` is passed to the runner (cargo), not parsed by the Tauri CLI.
  const configArgs = [
    "--config",
    JSON.stringify({ build: { devUrl: `http://localhost:${port}` } }),
  ];
  const sep = tauriArgs.indexOf("--");
  if (sep === -1) {
    tauriArgs.push(...configArgs);
  } else {
    tauriArgs.splice(sep, 0, ...configArgs);
  }
  console.log(
    `[tauri] port offset ${offset > 0 ? "+" : ""}${offset} → dev server on http://localhost:${port}`
  );
}

const binary = resolveTauriBinary();
const isJsEntry = binary.endsWith(".js");
const cmd = isJsEntry ? process.execPath : binary;
const args = isJsEntry ? [binary, ...tauriArgs] : tauriArgs;

// Debug: print the exact command we are about to run (set TAURI_WRAPPER_DEBUG=1).
if (process.env.TAURI_WRAPPER_DEBUG) {
  console.log(`[tauri] spawning: ${[cmd, ...args].join(" ")}`);
}
const child = spawn(cmd, args, { cwd: repoRoot, stdio: "inherit", env: process.env });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}

child.on("error", (err) => {
  console.error(`[tauri] failed to start the Tauri CLI: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

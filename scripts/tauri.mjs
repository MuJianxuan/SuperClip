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

import { spawn, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { get } from "node:http";
import { createServer } from "node:net";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 1420;
const PORT_SCAN_LIMIT = 20;
// Contract between this wrapper and vite.config.ts: the resolved port of the dev
// server. Tauri's devUrl is static config, so the wrapper must decide the port
// first and then pass it to both the Vite child process and `build.devUrl`.
const DEV_PORT_ENV = "SUPERCLIP_DEV_PORT";

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
const offsetArg = parseOffset(portOffsetArg);

// Only dev subcommands (dev, android dev, ios dev) consume build.devUrl.
const isDev =
  tauriArgs[0] === "dev" ||
  ((tauriArgs[0] === "android" || tauriArgs[0] === "ios") && tauriArgs[1] === "dev");

// Check whether a port can be bound on one address.
// `exclusive: true` mirrors Vite's own bind, so no other server can grab it first.
function canBind(port, host) {
  return new Promise((done) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => done(error.code === "EADDRINUSE" || error.code === "EACCES" ? false : true));
    server.listen({ port, host, exclusive: true }, () => server.close(() => done(true)));
  });
}

// Addresses Vite may bind or a client may resolve `localhost` to. macOS prefers
// IPv6 for `localhost`, and `0.0.0.0` / `::` wildcards do NOT cover a listener
// that is bound to the specific address ::1 or 127.0.0.1 on macOS. Probing only
// the wildcards therefore reports a false "free" port and Vite then dies with
// EADDRINUSE. Every address is probed individually so no collision slips through.
const PROBE_HOSTS = ["0.0.0.0", "::", "127.0.0.1", "::1"];

async function isPortFree(port) {
  for (const host of PROBE_HOSTS) {
    if (!(await canBind(port, host))) return false;
  }
  return true;
}

// Identifies who holds a port. Used only to tell "another app" apart from
// "a leftover SuperClip vite from an earlier run", so the message can point at
// the real cause. Port selection itself never kills anything.
function run(command, args) {
  return new Promise((done) => {
    const child = execFile(command, args, { timeout: 2000 }, (error, stdout) => done(stdout ?? ""));
    child.on("error", () => done(""));
  });
}

async function pidHoldingPort(port) {
  const out = await run("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]);
  const pid = out.split("\n").map((s) => s.trim()).find((s) => /^\d+$/.test(s));
  return pid ? Number.parseInt(pid, 10) : undefined;
}

// Best-effort: a process owned by another user cannot be inspected, so the cwd
// may be unreadable. That case must fall through, never be guessed.
async function pidWorkingDir(pid) {
  const out = await run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const line = out.split("\n").find((l) => l.startsWith("n"));
  return line ? line.slice(1) : undefined;
}

// Fallback when cwd is not readable: a SuperClip dev server answers with this title.
async function servesSuperClip(port) {
  return new Promise((done) => {
    const request = get({ host: "localhost", port, path: "/", timeout: 1500 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 8192) response.destroy();
      });
      response.on("end", () => done(/<title>\s*SuperClip\s*<\/title>/i.test(body)));
      response.on("error", () => done(false));
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => done(false));
  });
}

async function describeOccupant(port) {
  const pid = await pidHoldingPort(port);
  if (pid === undefined) return { self: false, label: "占用者未知" };
  const cwd = await pidWorkingDir(pid);
  const inRepo = cwd !== undefined && (cwd === repoRoot || cwd.startsWith(repoRoot + sep));
  const self = inRepo || (cwd === undefined && (await servesSuperClip(port)));
  const where = cwd ?? "cwd 不可读";
  return { self, pid, label: `PID ${pid}, cwd ${where}` };
}

async function findAvailablePort(start, limit) {
  const occupied = [];
  for (let i = 0; i < limit; i++) {
    const port = start + i;
    if (port > 65535) break;
    if (await isPortFree(port)) return { port, occupied };
    occupied.push({ port, ...(await describeOccupant(port)) });
  }
  return { port: undefined, occupied };
}

async function resolveDevPort() {
  // Explicit offset keeps the exact-port contract: fail loudly instead of drifting.
  if (offsetArg !== undefined || envOffset !== undefined) {
    const offset = offsetArg ?? envOffset;
    const port = DEFAULT_PORT + offset;
    if (port < 1 || port > 65535) {
      console.error(`[tauri] port ${port} is out of range (1-65535); aborting.`);
      process.exit(1);
    }
    const label = `port offset ${offset > 0 ? "+" : ""}${offset}`;
    return { port, reason: label };
  }
  const { port, occupied } = await findAvailablePort(DEFAULT_PORT, PORT_SCAN_LIMIT);
  if (port === undefined) {
    console.error(
      `[tauri] no free port in ${DEFAULT_PORT}-${DEFAULT_PORT + PORT_SCAN_LIMIT - 1}; ` +
        `pick one explicitly with: npm run tauri dev -- --port-offset <n>`
    );
    for (const entry of occupied) {
      console.error(`  ${entry.port}  ${entry.self ? "[本仓库遗留] " : ""}${entry.label}`);
    }
    process.exit(1);
  }
  // S1: report, never kill. A leftover SuperClip dev server may be a terminal the
  // user deliberately keeps open to iterate on the UI, so cleanup stays manual.
  for (const entry of occupied) {
    if (entry.self) {
      console.warn(
        `[tauri] 端口 ${entry.port} 被本仓库遗留的 dev server 占用（${entry.label}）。\n` +
          `        如需复用该端口：kill ${entry.pid ?? "<pid>"} 后重启；本次已另选端口。`
      );
    }
  }
  if (port === DEFAULT_PORT) return { port, reason: "default" };
  const others = occupied.filter((e) => !e.self).map((e) => e.port);
  if (others.length === 0) return { port, reason: "本仓库遗留端口已占用" };
  return { port, reason: `端口 ${others.join(", ")} 已被占用` };
}

if (isDev) {
  const { port, reason } = await resolveDevPort();

  // Hand the resolved port to the Vite child process (beforeDevCommand inherits
  // this env). Without it Vite would listen on its own default and Tauri would
  // load the wrong URL.
  process.env[DEV_PORT_ENV] = String(port);

  if (port !== DEFAULT_PORT) {
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
  }

  console.log(`[tauri] dev server on http://localhost:${port} (${reason})`);
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

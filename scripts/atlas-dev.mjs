import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertPortsFree } from "./ports.mjs";

const root = resolve(import.meta.dirname, "..");
const python = resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const children = [];
let stopping = false;
// Application records always use the Atlas URI/database in private configuration.
// Only the HTTP development endpoints and cookie policy are set here.
const env = {
  ...process.env,
  APP_ENV: "development",
  COOKIE_SECURE: "false",
  COOKIE_SAMESITE: "strict",
  API_INTERNAL_URL: "http://127.0.0.1:8000",
  NEXT_PUBLIC_API_BASE_URL: "/api/v1",
};

async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      await new Promise((done) => {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        killer.once("exit", done);
        killer.once("error", done);
      });
    } else child.kill("SIGTERM");
  }
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.once("error", async () => {
    console.error("A development service could not start. Check the installed toolchain.");
    process.exitCode = 1;
    await stop();
  });
  child.once("exit", async (code) => {
    if (!stopping) {
      process.exitCode = code || 0;
      await stop();
    }
  });
  return child;
}

process.once("SIGINT", async () => { await stop(); process.exit(); });
process.once("SIGTERM", async () => { await stop(); process.exit(); });

try {
  if (!existsSync(resolve(root, ".env"))) throw new Error("Create private Atlas configuration with scripts/setup.ps1 first.");
  const connectionStatus = await new Promise((done, fail) => {
    const check = spawn(python, [resolve(root, "scripts/check_atlas.py")], { cwd: root, env, stdio: "inherit" });
    check.once("error", fail);
    check.once("exit", done);
  });
  if (connectionStatus !== 0) throw new Error("Atlas connection failed. Correct the private database credentials/network access and retry. No local database will be started.");
  if (process.argv.includes("--check")) process.exit(0);
  await assertPortsFree([8000, 3000]);
  const backend = start(python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], resolve(root, "backend"));
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (backend.exitCode !== null) break;
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/health/ready", { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for FastAPI startup and Atlas indexes. */ }
    await new Promise((done) => setTimeout(done, 1000));
  }
  if (!ready) throw new Error("FastAPI did not become ready against Atlas. Check backend configuration and retry.");
  start(process.execPath, [resolve(root, "apps/web/node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], resolve(root, "apps/web"));
  console.log("Atlas mode: website http://127.0.0.1:3000; API http://127.0.0.1:8000/docs. Application data is stored in MongoDB Atlas.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  await stop();
}

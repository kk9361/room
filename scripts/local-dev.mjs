import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { assertPortsFree } from './ports.mjs';
const require = createRequire(import.meta.url);
let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = require("mongodb-memory-server"));
} catch {
  ({
    MongoMemoryServer,
  } = require("../.tools/node_modules/mongodb-memory-server"));
}
const root = resolve(import.meta.dirname, ".."),
  dbPath = resolve(root, ".local-data/mongodb");
if (!existsSync(resolve(root, ".env")))
  throw new Error(
    "Run scripts/setup.ps1 first to create your private backend configuration.",
  );
mkdirSync(dbPath, { recursive: true });
await assertPortsFree([8000, 3000, 27018]);
const mongo = await MongoMemoryServer.create({
  binary: { version: "8.2.1" },
  instance: { dbPath, port: 27018, ip: "127.0.0.1" },
});
const env = {
  ...process.env,
  MONGODB_URI: mongo.getUri(),
  MONGODB_DATABASE: "roommate_local",
  APP_ENV: "development",
  COOKIE_SECURE: "false",
};
const python = resolve(
  root,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
const children = [
  spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: resolve(root, "backend"), env, stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      resolve(root, "apps/web/node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
    ],
    { cwd: resolve(root, "apps/web"), env, stdio: "inherit" },
  ),
];
console.log(
  "Local mode: http://127.0.0.1:3000 · API: http://127.0.0.1:8000/docs",
);
console.log(
  "Uses roommate_local on loopback only; Atlas configuration is preserved. Credentials are in your private .env.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32")
      await new Promise((r) => {
        const p = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
        p.on("exit", r);
        p.on("error", r);
      });
    else child.kill("SIGTERM");
  }
  await mongo.stop({ doCleanup: false });
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("error", (error) => {
    console.error(error.message);
    stop();
  });
for (const child of children) child.on('exit', () => { if (!stopping) stop(); });

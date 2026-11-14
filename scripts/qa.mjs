import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, createWriteStream } from "node:fs";
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
const root = resolve(import.meta.dirname, "..");
const python = resolve(
  root,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
mkdirSync(resolve(root, "artifacts"), { recursive: true });
const children = [];
let mongo;
const apiPort = Number(process.env.QA_API_PORT || 8000);
const webPort = Number(process.env.QA_WEB_PORT || 3000);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const nextDistDir = process.env.NEXT_DIST_DIR || ".next";
function run(command, args, options = {}) {
  return new Promise((res, rej) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });
    child.on("error", rej);
    child.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${command} exited ${code}`)),
    );
  });
}
async function waitFor(url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not become ready: ${url}`);
}
async function stop() {
  for (const child of children.reverse()) {
    if (process.platform === "win32")
      await new Promise((r) => {
        const killer = spawn(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { stdio: "ignore" },
        );
        killer.on("exit", r);
        killer.on("error", r);
      });
    else child.kill("SIGTERM");
  }
  if (mongo) await mongo.stop();
}
try {
  if (!process.argv.includes('--backend-only')) await assertPortsFree(process.argv.includes('--serve-native') ? [apiPort] : [apiPort, webPort]);
  mongo = await MongoMemoryServer.create({ binary: { version: "8.2.1" } });
  const uri = mongo.getUri();
  const env = {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DATABASE: "qa_roommate",
    JWT_SECRET: "qa-only-secret-at-least-32-characters-never-deploy",
    BOOTSTRAP_USERNAME: "admin",
    BOOTSTRAP_PASSWORD: "TemporaryAdmin!123",
    COOKIE_SECURE: "false",
    APP_ENV: "test",
    CORS_ORIGINS: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
    TEST_MONGODB_URI: uri,
  };
  if (!process.argv.includes("--skip-backend"))
    await run(python, ["-m", "pytest", "-q"], {
      cwd: resolve(root, "backend"),
      env,
    });
  if (process.argv.includes("--backend-only")) {
    await stop();
    process.exit(0);
  }
  const apiLog = createWriteStream(resolve(root, "artifacts/qa-api.log"));
  const backend = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(apiPort)],
    { cwd: resolve(root, "backend"), env, stdio: ["ignore", "pipe", "pipe"] },
  );
  backend.stdout.pipe(apiLog);
  backend.stderr.pipe(apiLog);
  children.push(backend);
  await waitFor(`${apiUrl}/api/v1/health/ready`);
  if (process.argv.includes('--serve-native')) {
    console.log(`Temporary native QA API ready at ${apiUrl}. Uses only synthetic QA credentials. Type stop to shut down.`);
    await new Promise(resolve => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', data => { if (data.trim() === 'stop') resolve(); });
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
    await stop();
    process.exit(0);
  }
  const webLog = createWriteStream(resolve(root, "artifacts/qa-web.log"));
  const web = spawn(
    process.execPath,
    [
      resolve(root, "apps/web/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    {
      cwd: resolve(root, "apps/web"),
      env: {
        ...env,
        API_INTERNAL_URL: apiUrl,
        NEXT_DIST_DIR: nextDistDir,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  web.stdout.pipe(webLog);
  web.stderr.pipe(webLog);
  children.push(web);
  await waitFor(webUrl);
  await run(
    process.execPath,
    [
      resolve(root, "apps/web/node_modules/@playwright/test/cli.js"),
      "test",
      ...(process.argv.includes("--") ? process.argv.slice(process.argv.indexOf("--") + 1) : []),
    ],
    {
      cwd: resolve(root, "apps/web"),
      env: { ...env, PLAYWRIGHT_BASE_URL: webUrl },
    },
  );
  await stop();
} catch (error) {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
}

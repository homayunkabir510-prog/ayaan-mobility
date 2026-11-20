import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_PORT ?? "3100");
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  detached: process.platform !== "win32",
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});

function signalServerGroup(signal) {
  if (!server.pid) return;
  if (process.platform === "win32") {
    server.kill(signal);
    return;
  }
  try {
    process.kill(-server.pid, signal);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") return;
    throw error;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Next.js server did not become healthy: ${lastError instanceof Error ? lastError.message : "timeout"}`);
}

async function expectStatus(path, expected, options) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", ...options });
  if (response.status !== expected) throw new Error(`${path}: expected HTTP ${expected}, got ${response.status}.`);
  return response;
}

try {
  await waitForServer();
  await expectStatus("/api/health", 200);
  await expectStatus("/api/ready", 200);
  await expectStatus("/login", 200);
  const protectedResponse = await expectStatus("/admin", 307);
  if (!protectedResponse.headers.get("location")?.includes("/login")) {
    throw new Error("Unauthenticated /admin did not redirect to /login.");
  }
  console.log("Production smoke checks passed: health, DB readiness, login render, protected-route redirect.");
} finally {
  signalServerGroup("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5_000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (server.exitCode === null && server.signalCode === null) signalServerGroup("SIGKILL");
}

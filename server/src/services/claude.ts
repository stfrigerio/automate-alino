import { ChildProcess, spawn } from "child_process";
import { getSettings } from "./settings.js";

const AGENT_TIMEOUT_MS = 120_000;
const SIGKILL_GRACE_MS = 5_000;

function killProcess(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  const forceKill = setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  }, SIGKILL_GRACE_MS);
  forceKill.unref();
  child.on("close", () => clearTimeout(forceKill));
}

export function spawnClaude(prompt: string, opts?: { maxTurns?: number; timeoutMs?: number; allowedTools?: string[] }): Promise<string> {
  const maxTurns = opts?.maxTurns ?? 3;
  const timeoutMs = opts?.timeoutMs ?? AGENT_TIMEOUT_MS;
  const allowedTools = opts?.allowedTools ?? ["Read"];

  return new Promise((resolve, reject) => {
    const args = [
      "-p", "-",
      "--output-format", "text",
      "--max-turns", String(maxTurns),
      "--model", getSettings().model,
    ];
    if (allowedTools.length > 0) {
      args.push("--allowedTools", allowedTools.join(","));
    } else {
      args.push("--allowedTools", "");
    }

    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeoutHandle = setTimeout(() => {
      console.log("[spawnClaude] Agent timed out, killing");
      killProcess(child);
    }, timeoutMs);
    timeoutHandle.unref();

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `claude exited with code ${code}`));
    });

    child.on("error", (err) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const ENV_VAR_RE = /\$\{(\w+)\}/g;

function expandEnv(value: string): string {
  return value.replace(ENV_VAR_RE, (_, name) => process.env[name] ?? "");
}

export interface LoadOptions {
  configPath?: string;
}

export function loadDashscopeKey(opts: LoadOptions = {}): string {
  const envKey = process.env.DASHSCOPE_API_KEY;
  if (envKey) return envKey;

  const configPath = opts.configPath ?? join(homedir(), ".systemedu", "config.yaml");

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `No DashScope API key: env DASHSCOPE_API_KEY unset and config not found at ${configPath}`,
    );
  }

  const parsed = parseYaml(raw) as { llm?: { providers?: { qwen?: { api_key?: string } } } } | null;
  const rawKey = parsed?.llm?.providers?.qwen?.api_key ?? "";
  const expanded = expandEnv(rawKey).trim();
  if (!expanded) {
    throw new Error(`No DashScope API key: ${configPath} has no llm.providers.qwen.api_key`);
  }
  return expanded;
}

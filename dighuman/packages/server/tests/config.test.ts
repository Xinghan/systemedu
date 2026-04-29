import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDashscopeKey } from "../src/config.js";

describe("loadDashscopeKey", () => {
  const originalEnv = process.env.DASHSCOPE_API_KEY;
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "sdh-"));
    delete process.env.DASHSCOPE_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = originalEnv;
  });

  it("returns env var when set", () => {
    process.env.DASHSCOPE_API_KEY = "sk-from-env";
    const key = loadDashscopeKey({ configPath: "/does/not/exist" });
    expect(key).toBe("sk-from-env");
  });

  it("reads literal key from YAML config", () => {
    const cfg = join(tempHome, "config.yaml");
    writeFileSync(cfg, "llm:\n  providers:\n    qwen:\n      api_key: sk-literal-123\n");
    const key = loadDashscopeKey({ configPath: cfg });
    expect(key).toBe("sk-literal-123");
  });

  it("expands ${VAR} references from env", () => {
    process.env.MY_VAR = "sk-expanded";
    const cfg = join(tempHome, "config.yaml");
    writeFileSync(cfg, "llm:\n  providers:\n    qwen:\n      api_key: ${MY_VAR}\n");
    const key = loadDashscopeKey({ configPath: cfg });
    expect(key).toBe("sk-expanded");
    delete process.env.MY_VAR;
  });

  it("throws when no key found", () => {
    expect(() => loadDashscopeKey({ configPath: "/does/not/exist" })).toThrow(
      /no dashscope api key/i,
    );
  });
});

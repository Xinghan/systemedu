import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createWsServer } from "../src/ws/server.js";
import type { SessionRegistry } from "../src/ws/session.js";

describe("createWsServer", () => {
  let registry: SessionRegistry;
  let server: ReturnType<typeof createWsServer>;
  let url: string;

  beforeEach(async () => {
    server = createWsServer({ port: 0 });
    registry = server.registry;
    await new Promise<void>((r) => server.httpServer.once("listening", () => r()));
    const addr = server.httpServer.address() as AddressInfo;
    url = `ws://127.0.0.1:${addr.port}/ws?session_id=test-1`;
  });

  afterEach(async () => {
    server.wss.close();
    await new Promise<void>((r) => server.httpServer.close(() => r()));
  });

  it("registers a session on connect", async () => {
    const client = new WebSocket(url);
    await new Promise<void>((r) => client.once("open", () => r()));
    await new Promise((r) => setTimeout(r, 50));
    expect(registry.get("test-1")).toBeDefined();
    client.close();
  });

  it("unregisters on disconnect", async () => {
    const client = new WebSocket(url);
    await new Promise<void>((r) => client.once("open", () => r()));
    client.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(registry.get("test-1")).toBeUndefined();
  });

  it("rejects connection without session_id", async () => {
    const badUrl = url.replace(/\?.*/, "");
    const client = new WebSocket(badUrl);
    const result = await new Promise<{ kind: "error" | "close" }>((r) => {
      client.once("error", () => r({ kind: "error" }));
      client.once("close", () => r({ kind: "close" }));
    });
    expect(["error", "close"]).toContain(result.kind);
  });
});

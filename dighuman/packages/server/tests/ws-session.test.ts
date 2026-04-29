import { describe, expect, it, vi } from "vitest";
import { SessionRegistry } from "../src/ws/session.js";

describe("SessionRegistry", () => {
  it("registers and retrieves a session", () => {
    const reg = new SessionRegistry();
    const send = vi.fn();
    reg.register("sess1", send);
    expect(reg.get("sess1")?.send).toBe(send);
  });

  it("overwrites a duplicate session id", () => {
    const reg = new SessionRegistry();
    const a = vi.fn();
    const b = vi.fn();
    reg.register("sess1", a);
    reg.register("sess1", b);
    expect(reg.get("sess1")?.send).toBe(b);
  });

  it("removes a session", () => {
    const reg = new SessionRegistry();
    reg.register("sess1", vi.fn());
    reg.remove("sess1");
    expect(reg.get("sess1")).toBeUndefined();
  });
});

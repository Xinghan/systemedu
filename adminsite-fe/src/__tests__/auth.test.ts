import { getAccessToken, getRefreshToken, setTokens, clearTokens, isLoggedIn } from "@/lib/auth";

// Mock localStorage
const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key]);

  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    },
    writable: true,
  });
});

describe("auth token management", () => {
  test("getAccessToken returns null when no token", () => {
    expect(getAccessToken()).toBeNull();
  });

  test("getRefreshToken returns null when no token", () => {
    expect(getRefreshToken()).toBeNull();
  });

  test("setTokens stores both tokens", () => {
    setTokens("access123", "refresh456");
    expect(getAccessToken()).toBe("access123");
    expect(getRefreshToken()).toBe("refresh456");
  });

  test("clearTokens removes both tokens", () => {
    setTokens("access123", "refresh456");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test("isLoggedIn returns false when no token", () => {
    expect(isLoggedIn()).toBe(false);
  });

  test("isLoggedIn returns true when token exists", () => {
    setTokens("access123", "refresh456");
    expect(isLoggedIn()).toBe(true);
  });

  test("uses systemedu_admin_ prefix for keys", () => {
    setTokens("a", "r");
    expect(store["systemedu_admin_access"]).toBe("a");
    expect(store["systemedu_admin_refresh"]).toBe("r");
  });
});

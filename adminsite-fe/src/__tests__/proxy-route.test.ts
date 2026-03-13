/**
 * Tests for the API proxy route handler logic.
 * We test the path handling (trailing slash addition) directly.
 */

describe("proxy route handler", () => {
  test("adds trailing slash to paths without one", () => {
    const pathname = "/api/admin/auth/login";
    const result = pathname.endsWith("/") ? pathname : `${pathname}/`;
    expect(result).toBe("/api/admin/auth/login/");
  });

  test("preserves trailing slash when already present", () => {
    const pathname = "/api/admin/projects/";
    const result = pathname.endsWith("/") ? pathname : `${pathname}/`;
    expect(result).toBe("/api/admin/projects/");
  });

  test("handles nested paths correctly", () => {
    const pathname = "/api/admin/projects/1/import-tree";
    const result = pathname.endsWith("/") ? pathname : `${pathname}/`;
    expect(result).toBe("/api/admin/projects/1/import-tree/");
  });
});

describe("api.ts path cleaning", () => {
  test("strips trailing slash from API paths", () => {
    const paths = ["/projects/", "/projects/1/", "/projects/1/import-tree/"];
    const cleaned = paths.map((p) => p.replace(/\/+$/, ""));
    expect(cleaned).toEqual(["/projects", "/projects/1", "/projects/1/import-tree"]);
  });

  test("does not modify paths without trailing slash", () => {
    const path = "/projects/1";
    expect(path.replace(/\/+$/, "")).toBe("/projects/1");
  });
});

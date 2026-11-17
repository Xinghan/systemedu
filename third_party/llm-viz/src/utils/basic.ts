// Adapted from bbycroft/llm-viz (MIT), pinned 9da9374. See third_party/llm-viz/README.md at the repository root.

export function nonNil<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

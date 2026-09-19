export type DrivingRules = Record<"clear" | "sand" | "rock" | "unknown", string>;
export function validRules(value: unknown): value is DrivingRules;
export function runRules(rules: DrivingRules, route: "training" | "transfer"): {
  route_id: string;
  signature: string;
  passed: boolean;
  status: string;
  trace: unknown[];
  steps: unknown[];
};

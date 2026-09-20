export type DrivingRules = Record<"clear" | "sand" | "rock" | "unknown", string>;
export function validRules(value: unknown): value is DrivingRules;
export function runRules(rules: DrivingRules, route: "training" | "transfer"): {
  route_id: string;
  signature: string;
  passed: boolean;
  status: string;
  trace: unknown[];
  steps: { index: number; terrain: string; action: string; from: number; to: number; outcome: string; time: number }[];
};

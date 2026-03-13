"use client";

import { useState, useRef } from "react";
import Button from "./Button";
import { generateTree, pollTaskUntilDone } from "@/lib/api";
import { toast } from "./Toast";
import type { TreeGranularity } from "@/lib/types";

interface TreeGeneratorProps {
  projectId: number;
  hasExistingTree: boolean;
  onImported?: () => void;
  onComplete?: () => void;
}

const GRANULARITY_OPTIONS: { value: TreeGranularity; label: string; desc: string }[] = [
  { value: "coarse", label: "Coarse", desc: "20-50 nodes, high-level outline" },
  { value: "medium", label: "Medium", desc: "100-300 nodes, balanced detail" },
  { value: "fine",   label: "Fine",   desc: "500-1500 nodes, atomic units" },
];

type TaskPhase = "idle" | "submitting" | "pending" | "running" | "done";

export default function TreeGenerator({ projectId, hasExistingTree, onImported, onComplete }: TreeGeneratorProps) {
  const [granularity, setGranularity] = useState<TreeGranularity>("medium");
  const [instructions, setInstructions] = useState("");
  const [phase, setPhase] = useState<TaskPhase>("idle");
  const [resultJson, setResultJson] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const cancelledRef = useRef(false);

  const generating = phase !== "idle" && phase !== "done";

  async function handleGenerate() {
    setPhase("submitting");
    setResultJson("");
    setResultSummary("");
    setShowPreview(false);
    cancelledRef.current = false;
    try {
      const kickoff = await generateTree(projectId, { granularity, instructions });
      if (cancelledRef.current) return;

      setPhase("pending");
      const result = await pollTaskUntilDone(kickoff.task_id);
      if (cancelledRef.current) return;

      if (result.status === "completed" && result.tree_data) {
        setResultJson(JSON.stringify(result.tree_data, null, 2));
        const ms = result.milestones_created ?? 0;
        const kn = result.knodes_created ?? 0;
        setResultSummary(`Generated and saved ${ms} milestones, ${kn} nodes`);
        toast(`Generated and saved ${ms} milestones, ${kn} nodes`);
        onImported?.();
        onComplete?.();
      } else {
        toast(result.error || "Generation failed", "error");
      }
    } catch (err) {
      if (!cancelledRef.current) {
        toast((err as Error).message || "Generation failed", "error");
      }
    } finally {
      if (!cancelledRef.current) {
        setPhase("idle");
      }
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    setPhase("idle");
  }

  function handleDownload() {
    if (!resultJson) return;
    const blob = new Blob([resultJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated_tree_${granularity}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function statusText(): string {
    switch (phase) {
      case "submitting": return "Submitting task...";
      case "pending":    return "Task queued, waiting for AI to start...";
      case "running":    return "AI is generating the knowledge tree...";
      default:           return "";
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-text-primary">AI Generate Knowledge Tree</h4>

      {/* Granularity selector */}
      <div>
        <label className="block text-xs text-text-secondary mb-2">Granularity</label>
        <div className="flex gap-2">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGranularity(opt.value)}
              disabled={generating}
              className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                granularity === opt.value
                  ? "border-accent bg-accent/10 text-text-primary"
                  : "border-border bg-bg-elevated text-text-secondary hover:border-border-light"
              }`}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-[11px] text-text-muted mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-xs text-text-secondary mb-1">Additional Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g., Learners have zero CS background, focus on hands-on experiments, include more coding exercises..."
          rows={2}
          disabled={generating}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
      </div>

      <div className="flex gap-3 items-center">
        <Button onClick={handleGenerate} loading={generating} disabled={generating}>
          {generating ? "Generating..." : "Generate with AI"}
        </Button>
        {generating && (
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>

      {generating && (
        <p className="text-xs text-text-secondary animate-pulse">
          {statusText()} This may take 1-2 minutes for fine granularity.
        </p>
      )}

      {/* Success summary */}
      {resultSummary && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
          <p className="text-sm text-green-400 font-medium">{resultSummary}</p>
        </div>
      )}

      {/* Generated JSON preview (read-only, collapsible) */}
      {resultJson && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
            >
              {showPreview ? "Hide" : "Show"} generated JSON
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="text-xs text-accent hover:text-accent/80 cursor-pointer"
            >
              Download JSON
            </button>
          </div>
          {showPreview && (
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text-secondary font-mono">
              {resultJson}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Button from "./Button";
import { generateTree, importTree } from "@/lib/api";
import { toast } from "./Toast";
import type { TreeGranularity } from "@/lib/types";

interface TreeGeneratorProps {
  projectId: number;
  hasExistingTree: boolean;
  onImported: () => void;
}

const GRANULARITY_OPTIONS: { value: TreeGranularity; label: string; desc: string }[] = [
  { value: "coarse", label: "Coarse", desc: "20-50 nodes, high-level outline" },
  { value: "medium", label: "Medium", desc: "100-300 nodes, balanced detail" },
  { value: "fine",   label: "Fine",   desc: "500-1500 nodes, atomic units" },
];

export default function TreeGenerator({ projectId, hasExistingTree, onImported }: TreeGeneratorProps) {
  const [granularity, setGranularity] = useState<TreeGranularity>("medium");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedJson, setGeneratedJson] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setGeneratedJson("");
    try {
      const result = await generateTree(projectId, { granularity, instructions });
      setGeneratedJson(JSON.stringify(result.tree_data, null, 2));
      toast("Knowledge tree generated successfully");
    } catch (err) {
      toast((err as Error).message || "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleImport() {
    if (!generatedJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(generatedJson);
      const result = await importTree(projectId, parsed, hasExistingTree);
      toast(`Imported ${result.milestones_created} milestones, ${result.knodes_created} nodes`);
      setGeneratedJson("");
      onImported();
    } catch (err) {
      const msg = err instanceof SyntaxError ? "Invalid JSON" : (err as Error).message;
      toast(msg, "error");
    } finally {
      setImporting(false);
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

      <Button onClick={handleGenerate} loading={generating} disabled={generating}>
        {generating ? "Generating..." : "Generate with AI"}
      </Button>

      {generating && (
        <p className="text-xs text-text-secondary animate-pulse">
          AI is generating the knowledge tree. This may take 1-2 minutes for fine granularity...
        </p>
      )}

      {/* Generated JSON preview */}
      {generatedJson && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-text-primary">Generated JSON Preview</h4>
            <span className="text-xs text-text-secondary">
              You can edit the JSON before importing
            </span>
          </div>
          <textarea
            value={generatedJson}
            onChange={(e) => setGeneratedJson(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setGeneratedJson("")}>
              Discard
            </Button>
            <Button onClick={handleImport} loading={importing}>
              Import Generated Tree
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

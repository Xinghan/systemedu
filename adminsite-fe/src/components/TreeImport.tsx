"use client";

import { useState, useRef } from "react";
import Button from "./Button";
import { importTree, importTreeFile } from "@/lib/api";
import { toast } from "./Toast";

interface TreeImportProps {
  projectId: number;
  hasExistingTree: boolean;
  onImported: () => void;
}

export default function TreeImport({ projectId, hasExistingTree, onImported }: TreeImportProps) {
  const [jsonText, setJsonText] = useState("");
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePasteImport() {
    if (!jsonText.trim()) return;
    setLoading(true);
    try {
      const parsed = JSON.parse(jsonText);
      const result = await importTree(projectId, parsed, replace);
      toast(`Imported ${result.milestones_created} milestones, ${result.knodes_created} nodes`);
      setJsonText("");
      onImported();
    } catch (err) {
      const msg = err instanceof SyntaxError ? "Invalid JSON" : (err as Error).message;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setLoading(true);
    try {
      const result = await importTreeFile(projectId, file, replace);
      toast(`Imported ${result.milestones_created} milestones, ${result.knodes_created} nodes`);
      onImported();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      handleFileUpload(file);
    } else {
      toast("Please drop a .json file", "error");
    }
  }

  function downloadTemplate() {
    const template = {
      milestones: [
        {
          title: "Getting Started",
          description: "Foundational concepts and setup",
          order: 0,
          knodes: [
            {
              title: "Introduction to the Project",
              summary: "Overview of what we will build and learn",
              difficulty_level: 1,
              content_type: "text",
              acceptance_type: "quiz",
              estimated_minutes: 15,
              xp_reward: 20,
              order: 0,
              prerequisite_indices: [],
            },
            {
              title: "Setting Up the Environment",
              summary: "Install required tools and dependencies",
              difficulty_level: 2,
              content_type: "interactive",
              acceptance_type: "auto",
              estimated_minutes: 30,
              xp_reward: 30,
              order: 1,
              prerequisite_indices: [0],
            },
          ],
        },
        {
          title: "Core Concepts",
          description: "Main learning topics",
          order: 1,
          knodes: [
            {
              title: "First Core Concept",
              summary: "Detailed explanation of the first key topic",
              difficulty_level: 3,
              content_type: "text",
              acceptance_type: "quiz",
              estimated_minutes: 25,
              xp_reward: 30,
              order: 0,
              prerequisite_indices: [0, 1],
            },
            {
              title: "Hands-on Practice",
              summary: "Apply what you learned with a guided exercise",
              difficulty_level: 4,
              content_type: "code",
              acceptance_type: "code_submit",
              estimated_minutes: 45,
              xp_reward: 50,
              order: 1,
              prerequisite_indices: [2],
            },
          ],
        },
      ],
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-tree-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">Import Knowledge Tree</h4>
        {hasExistingTree && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-elevated text-accent"
            />
            <span className="text-xs text-text-secondary">Replace existing tree</span>
          </label>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-accent bg-accent-muted" : "border-border hover:border-border-light"
        }`}
      >
        <svg className="w-8 h-8 mx-auto text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-text-secondary">
          Drop a <span className="text-text-primary font-medium">.json</span> file here or click to upload
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>

      {/* Or paste JSON */}
      <div className="relative">
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='Or paste JSON here... {"milestones": [...]}'
          rows={6}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono resize-y"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handlePasteImport} loading={loading} disabled={!jsonText.trim()}>
          Import JSON
        </Button>
      </div>

      {/* Download template + JSON Format Reference */}
      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download JSON Template
        </button>
      </div>

      <JsonFormatReference />
    </div>
  );
}

function JsonFormatReference() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
      >
        <span className="font-medium">JSON Format Reference</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-text-secondary space-y-3 border-t border-border pt-3">
          <pre className="bg-bg-elevated rounded-lg p-3 overflow-x-auto text-text-primary font-mono leading-relaxed">{`{
  "milestones": [
    {
      "title": "Milestone Title (required)",
      "description": "Optional description",
      "order": 0,
      "knodes": [
        {
          "title": "Node Title (required)",
          "summary": "Optional summary",
          "difficulty_level": 3,
          "content_type": "text",
          "acceptance_type": "quiz",
          "estimated_minutes": 15,
          "xp_reward": 20,
          "order": 0,
          "prerequisite_indices": [0, 3]
        }
      ]
    }
  ]
}`}</pre>

          <div>
            <p className="font-medium text-text-primary mb-1">Global Index Calculation</p>
            <p>Knodes are numbered sequentially across all milestones:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>milestones[0].knodes[0] = index 0</li>
              <li>milestones[0].knodes[1] = index 1</li>
              <li>milestones[1].knodes[0] = N (where N = milestones[0].knodes.length)</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-medium text-text-primary mb-1">content_type</p>
              <code className="text-[10px]">text | interactive | code | experiment | quiz | video</code>
            </div>
            <div>
              <p className="font-medium text-text-primary mb-1">acceptance_type</p>
              <code className="text-[10px]">quiz | code_submit | essay | demo | peer_review | auto</code>
            </div>
            <div>
              <p className="font-medium text-text-primary mb-1">difficulty_level</p>
              <code className="text-[10px]">1 - 10</code>
            </div>
            <div>
              <p className="font-medium text-text-primary mb-1">prerequisite_indices</p>
              <code className="text-[10px]">Global indices, must form DAG (no cycles)</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

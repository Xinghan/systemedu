"use client";

import Link from "next/link";
import type { AdminProject } from "@/lib/types";
import { CATEGORY_OPTIONS } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface ProjectTableProps {
  projects: AdminProject[];
  onClone: (project: AdminProject) => void;
  onDelete: (project: AdminProject) => void;
}

function getCategoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label || value;
}

export default function ProjectTable({ projects, onClone, onDelete }: ProjectTableProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-12 text-center">
        <p className="text-text-secondary text-sm">No projects yet.</p>
        <Link
          href="/projects/new"
          className="inline-block mt-3 text-sm text-accent hover:text-accent-hover font-medium"
        >
          Create your first project
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-5 py-3 text-text-secondary font-medium">Title</th>
            <th className="px-5 py-3 text-text-secondary font-medium">Category</th>
            <th className="px-5 py-3 text-text-secondary font-medium">Ages</th>
            <th className="px-5 py-3 text-text-secondary font-medium">Hours</th>
            <th className="px-5 py-3 text-text-secondary font-medium">Nodes</th>
            <th className="px-5 py-3 text-text-secondary font-medium">Status</th>
            <th className="px-5 py-3 text-text-secondary font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50 transition-colors">
              <td className="px-5 py-3">
                <Link href={`/projects/${p.id}`} className="text-text-primary hover:text-accent font-medium">
                  {p.title}
                </Link>
                {p.subtitle && (
                  <p className="text-text-muted text-xs mt-0.5 truncate max-w-xs">{p.subtitle}</p>
                )}
              </td>
              <td className="px-5 py-3 text-text-secondary">{getCategoryLabel(p.category)}</td>
              <td className="px-5 py-3 text-text-secondary">{p.min_age}-{p.max_age}</td>
              <td className="px-5 py-3 text-text-secondary">{p.estimated_hours}h</td>
              <td className="px-5 py-3 text-text-secondary">{p.milestone_count}</td>
              <td className="px-5 py-3">
                <StatusBadge published={p.is_published} template={p.is_template} />
              </td>
              <td className="px-5 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-text-secondary hover:text-accent text-xs font-medium"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => onClone(p)}
                    className="text-text-secondary hover:text-accent text-xs font-medium cursor-pointer"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    className="text-text-secondary hover:text-danger text-xs font-medium cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

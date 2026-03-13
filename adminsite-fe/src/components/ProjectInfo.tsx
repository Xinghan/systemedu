"use client";

import type { AdminProjectDetail } from "@/lib/types";
import { CATEGORY_OPTIONS } from "@/lib/types";

interface ProjectInfoProps {
  project: AdminProjectDetail;
}

function getCategoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label || value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectInfo({ project }: ProjectInfoProps) {
  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-2xl space-y-5">
      {/* Description */}
      {project.description && (
        <div>
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
            Description
          </h3>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">
            {project.description}
          </p>
        </div>
      )}

      {/* Details grid */}
      <div className="border-t border-border pt-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-text-muted text-xs">Category</dt>
            <dd className="text-text-primary font-medium">
              {getCategoryLabel(project.category)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Age Range</dt>
            <dd className="text-text-primary font-medium">
              {project.min_age} – {project.max_age}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Estimated Hours</dt>
            <dd className="text-text-primary font-medium">
              {project.estimated_hours}h
            </dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Template</dt>
            <dd className="text-text-primary font-medium">
              {project.is_template ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Created</dt>
            <dd className="text-text-primary font-medium">
              {formatDate(project.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Updated</dt>
            <dd className="text-text-primary font-medium">
              {formatDate(project.updated_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Subtitle if present */}
      {project.subtitle && (
        <div className="border-t border-border pt-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
            Subtitle
          </h3>
          <p className="text-sm text-text-secondary">{project.subtitle}</p>
        </div>
      )}

      {/* Cover image if present */}
      {project.cover_image && (
        <div className="border-t border-border pt-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
            Cover Image
          </h3>
          <p className="text-sm text-text-secondary break-all">{project.cover_image}</p>
        </div>
      )}
    </div>
  );
}

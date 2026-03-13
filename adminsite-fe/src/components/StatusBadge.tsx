"use client";

interface StatusBadgeProps {
  published: boolean;
  template?: boolean;
}

export default function StatusBadge({ published, template }: StatusBadgeProps) {
  if (template) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning-muted text-warning">
        Template
      </span>
    );
  }
  if (published) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-success-muted text-success">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-accent-muted text-accent">
      Draft
    </span>
  );
}

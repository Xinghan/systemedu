"use client";

import { TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export default function FormTextarea({ label, error, id, className = "", ...props }: FormTextareaProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <textarea
        id={inputId}
        className={`w-full rounded-lg border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[80px] ${
          error ? "border-danger" : "border-border"
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

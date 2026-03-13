"use client";

import { useState } from "react";
import type { ProjectFormData } from "@/lib/types";
import { CATEGORY_OPTIONS } from "@/lib/types";
import Button from "./Button";
import FormInput from "./FormInput";
import FormTextarea from "./FormTextarea";
import FormSelect from "./FormSelect";

interface ProjectFormProps {
  initial?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  submitLabel: string;
}

const defaultData: ProjectFormData = {
  title: "",
  subtitle: "",
  description: "",
  cover_image: "",
  category: "other",
  min_age: 6,
  max_age: 18,
  estimated_hours: 10,
  is_published: false,
  is_template: false,
};

export default function ProjectForm({ initial, onSubmit, submitLabel }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormData>({ ...defaultData, ...initial });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.description.trim()) errs.description = "Description is required";
    if (form.min_age > form.max_age) errs.min_age = "Min age must be <= max age";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await onSubmit(form);
    } catch {
      // handled by caller
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormInput
        label="Title"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="e.g. Build a Neural Network from Scratch"
        error={errors.title}
      />
      <FormInput
        label="Subtitle"
        value={form.subtitle}
        onChange={(e) => set("subtitle", e.target.value)}
        placeholder="Short tagline"
      />
      <FormTextarea
        label="Description"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Detailed project description..."
        rows={4}
        error={errors.description}
      />
      <FormInput
        label="Cover Image URL"
        value={form.cover_image}
        onChange={(e) => set("cover_image", e.target.value)}
        placeholder="https://..."
      />
      <div className="grid grid-cols-2 gap-4">
        <FormSelect
          label="Category"
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          options={CATEGORY_OPTIONS}
        />
        <FormInput
          label="Estimated Hours"
          type="number"
          min={1}
          value={form.estimated_hours}
          onChange={(e) => set("estimated_hours", Number(e.target.value))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Min Age"
          type="number"
          min={1}
          max={99}
          value={form.min_age}
          onChange={(e) => set("min_age", Number(e.target.value))}
          error={errors.min_age}
        />
        <FormInput
          label="Max Age"
          type="number"
          min={1}
          max={99}
          value={form.max_age}
          onChange={(e) => set("max_age", Number(e.target.value))}
        />
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_template}
            onChange={(e) => set("is_template", e.target.checked)}
            className="w-4 h-4 rounded border-border bg-bg-elevated text-accent focus:ring-accent"
          />
          <span className="text-sm text-text-secondary">Template</span>
        </label>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

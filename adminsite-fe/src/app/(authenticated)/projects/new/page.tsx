"use client";

import { useRouter } from "next/navigation";
import { createProject, ApiError } from "@/lib/api";
import { toast } from "@/components/Toast";
import type { ProjectFormData } from "@/lib/types";
import ProjectForm from "@/components/ProjectForm";

export default function NewProjectPage() {
  const router = useRouter();

  async function handleSubmit(data: ProjectFormData) {
    try {
      const project = await createProject(data);
      toast(`Created "${project.title}"`);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.data) {
        const messages = Object.values(err.data).flat().join(", ");
        toast(messages || "Failed to create project", "error");
      } else {
        toast("Failed to create project", "error");
      }
      throw err;
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-6">Create New Project</h1>
      <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-2xl">
        <ProjectForm onSubmit={handleSubmit} submitLabel="Create Project" />
      </div>
    </div>
  );
}

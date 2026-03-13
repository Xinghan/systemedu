"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api";
import { toast } from "@/components/Toast";
import type { AdminProjectDetail } from "@/lib/types";
import TreeGenerator from "@/components/TreeGenerator";

export default function GenerateTreePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<AdminProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch {
      toast("Failed to load project", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-text-secondary">Project not found.</p>;
  }

  const hasTree = project.milestones.length > 0;

  return (
    <div>
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="text-sm text-text-secondary hover:text-text-primary mb-4 cursor-pointer"
      >
        &larr; Back to {project.title}
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6">
        AI Generate Knowledge Tree
      </h1>

      <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-3xl">
        <TreeGenerator
          projectId={projectId}
          hasExistingTree={hasTree}
          onComplete={() => router.push(`/projects/${projectId}`)}
        />
      </div>
    </div>
  );
}

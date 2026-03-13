"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, updateProject, exportTree, getTreePreview, cloneProject, ApiError } from "@/lib/api";
import { toast } from "@/components/Toast";
import type { AdminProjectDetail, ProjectFormData, TreeGraph } from "@/lib/types";
import TabBar from "@/components/TabBar";
import ProjectForm from "@/components/ProjectForm";
import TreePreview from "@/components/TreePreview";
import TaskBanner from "@/components/TaskBanner";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import FormInput from "@/components/FormInput";

const TABS = ["Info", "Knowledge Tree"];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<AdminProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Info");
  const [treeGraph, setTreeGraph] = useState<TreeGraph | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  // Clone modal
  const [showClone, setShowClone] = useState(false);
  const [cloneTitle, setCloneTitle] = useState("");
  const [cloning, setCloning] = useState(false);

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

  const fetchTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const graph = await getTreePreview(projectId);
      setTreeGraph(graph);
    } catch {
      // No tree yet — that's ok
      setTreeGraph({ nodes: [], edges: [] });
    } finally {
      setTreeLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (activeTab === "Knowledge Tree") fetchTree();
  }, [activeTab, fetchTree]);

  async function handleUpdate(data: ProjectFormData) {
    try {
      await updateProject(projectId, data);
      toast("Project updated");
      fetchProject();
    } catch (err) {
      if (err instanceof ApiError && err.data) {
        const messages = Object.values(err.data).flat().join(", ");
        toast(messages || "Failed to update", "error");
      } else {
        toast("Failed to update", "error");
      }
      throw err;
    }
  }

  async function handleExport() {
    try {
      const data = await exportTree(projectId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.title || "tree"}_knowledge_tree.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Tree exported");
    } catch {
      toast("Failed to export tree", "error");
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const newProject = await cloneProject(projectId, cloneTitle || undefined);
      toast(`Cloned as "${newProject.title}"`);
      setShowClone(false);
      router.push(`/projects/${newProject.id}`);
    } catch {
      toast("Failed to clone", "error");
    } finally {
      setCloning(false);
    }
  }

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
      <TaskBanner
        projectId={projectId}
        onTaskComplete={() => { fetchProject(); fetchTree(); }}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-text-secondary hover:text-text-primary mb-1 cursor-pointer"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-text-primary">{project.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowClone(true); setCloneTitle(`${project.title} (Copy)`); }}>
            Clone
          </Button>
        </div>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Info" && (
          <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-2xl">
            <ProjectForm
              initial={{
                title: project.title,
                subtitle: project.subtitle,
                description: project.description,
                cover_image: project.cover_image,
                category: project.category,
                min_age: project.min_age,
                max_age: project.max_age,
                estimated_hours: project.estimated_hours,
                is_published: project.is_published,
                is_template: project.is_template,
              }}
              onSubmit={handleUpdate}
              submitLabel="Save Changes"
            />
          </div>
        )}

        {activeTab === "Knowledge Tree" && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex gap-3">
              <Button onClick={() => router.push(`/projects/${projectId}/generate`)}>
                AI Generate
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/projects/${projectId}/import`)}>
                Import JSON
              </Button>
              {hasTree && (
                <Button variant="secondary" onClick={handleExport}>
                  Export
                </Button>
              )}
            </div>

            {/* Tree visualization */}
            {treeLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
              </div>
            ) : treeGraph && treeGraph.nodes.length > 0 ? (
              <TreePreview graph={treeGraph} />
            ) : (
              <div className="border border-dashed border-border rounded-xl p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
                <p className="text-text-secondary text-sm font-medium mb-1">No knowledge tree yet</p>
                <p className="text-text-muted text-xs mb-4">
                  Generate one with AI or import a JSON file to get started.
                </p>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => router.push(`/projects/${projectId}/generate`)}>
                    AI Generate
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/projects/${projectId}/import`)}>
                    Import JSON
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clone modal */}
      <Modal open={showClone} onClose={() => setShowClone(false)} title="Clone Project">
        <FormInput
          label="New Project Title"
          value={cloneTitle}
          onChange={(e) => setCloneTitle(e.target.value)}
          className="mb-4"
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowClone(false)}>
            Cancel
          </Button>
          <Button onClick={handleClone} loading={cloning}>
            Clone
          </Button>
        </div>
      </Modal>
    </div>
  );
}

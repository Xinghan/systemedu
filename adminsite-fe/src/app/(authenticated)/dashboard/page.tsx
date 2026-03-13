"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProjects, deleteProject, cloneProject } from "@/lib/api";
import { toast } from "@/components/Toast";
import type { AdminProject } from "@/lib/types";
import StatsCard from "@/components/StatsCard";
import ProjectTable from "@/components/ProjectTable";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Clone modal
  const [cloneTarget, setCloneTarget] = useState<AdminProject | null>(null);
  const [cloneTitle, setCloneTitle] = useState("");
  const [cloning, setCloning] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch {
      toast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      toast(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
      fetchProjects();
    } catch {
      toast("Failed to delete project", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleClone() {
    if (!cloneTarget) return;
    setCloning(true);
    try {
      const newProject = await cloneProject(cloneTarget.id, cloneTitle || undefined);
      toast(`Cloned as "${newProject.title}"`);
      setCloneTarget(null);
      setCloneTitle("");
      router.push(`/projects/${newProject.id}`);
    } catch {
      toast("Failed to clone project", "error");
    } finally {
      setCloning(false);
    }
  }

  const totalProjects = projects.length;
  const publishedCount = projects.filter((p) => p.is_published).length;
  const totalNodes = projects.reduce((sum, p) => sum + p.milestone_count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
        <Button onClick={() => router.push("/projects/new")}>
          + New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatsCard
          label="Total Projects"
          value={loading ? "..." : totalProjects}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
        />
        <StatsCard
          label="Published"
          value={loading ? "..." : publishedCount}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label="Total Milestones"
          value={loading ? "..." : totalNodes}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          }
        />
      </div>

      {/* Project table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : (
        <ProjectTable
          projects={projects}
          onClone={(p) => { setCloneTarget(p); setCloneTitle(`${p.title} (Copy)`); }}
          onDelete={setDeleteTarget}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
      >
        <p className="text-sm text-text-secondary mb-4">
          Are you sure you want to delete <span className="text-text-primary font-medium">&quot;{deleteTarget?.title}&quot;</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Clone modal */}
      <Modal
        open={!!cloneTarget}
        onClose={() => setCloneTarget(null)}
        title="Clone Project"
      >
        <FormInput
          label="New Project Title"
          value={cloneTitle}
          onChange={(e) => setCloneTitle(e.target.value)}
          placeholder="My cloned project"
          className="mb-4"
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCloneTarget(null)}>
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

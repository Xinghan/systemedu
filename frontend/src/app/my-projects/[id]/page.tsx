"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";
import { getProject, getProjectProgress, getProgressSummary } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type {
  ProjectDetail,
  Milestone,
  NodeProgress,
  ProgressSummary,
} from "@/lib/types";

const statusConfig: Record<
  string,
  { color: string; bg: string; icon: string; label?: string }
> = {
  locked: { color: "text-[#5a6b7f]", bg: "bg-[#2a3548]/40", icon: "🔒" },
  available: {
    color: "text-blue-300",
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: "🔵",
    label: "Start",
  },
  in_progress: {
    color: "text-yellow-300",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: "🟡",
    label: "Continue",
  },
  submitted: {
    color: "text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: "📤",
  },
  passed: {
    color: "text-green-300",
    bg: "bg-green-500/10 border-green-500/30",
    icon: "✅",
  },
  failed: {
    color: "text-red-300",
    bg: "bg-red-500/10 border-red-500/30",
    icon: "❌",
    label: "Retry",
  },
};

function MilestoneAccordion({
  milestone,
  index,
  isOpen,
  onToggle,
  nodeProgressMap,
  projectId,
}: {
  milestone: Milestone;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  nodeProgressMap: Map<number, NodeProgress>;
  projectId: number;
}) {
  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isOpen
          ? "border-[#b8a0d8]/60 bg-[#2a2540]/40 shadow-lg shadow-[#b8a0d8]/10"
          : "border-[#3a4a60]/50 bg-[#1a2535]/60 hover:border-[#4a5a70]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 cursor-pointer text-left"
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            isOpen
              ? "bg-[#b8a0d8] text-[#1a1a2e]"
              : "bg-[#2a3548] text-[#8a9bb5]"
          }`}
        >
          {index + 1}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold">{milestone.title}</h3>
          <p className="text-[#6a7b8f] text-sm">{milestone.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8a9bb5] bg-[#2a3548] px-2 py-1 rounded">
            {milestone.xp_reward} XP
          </span>
          <span
            className={`text-[#6a7b8f] transition-transform duration-300 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 page-enter">
          <div className="ml-14 border-t border-[#3a4a60]/50 pt-4 space-y-3">
            {milestone.knodes.map((node) => {
              const progress = nodeProgressMap.get(node.id);
              const nodeStatus = progress?.status || "locked";
              const cfg = statusConfig[nodeStatus] || statusConfig.locked;

              return (
                <div
                  key={node.id}
                  className={`rounded-lg p-3 border border-[#3a4a60]/30 flex items-center gap-3 ${cfg.bg}`}
                >
                  <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm ${cfg.color}`}>
                      {node.title}
                    </h4>
                    {node.summary && (
                      <p className="text-[#6a7b8f] text-xs mt-1 line-clamp-1">
                        {node.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#5a6b7f]">
                        ~{node.estimated_minutes}min
                      </span>
                      <span className="text-xs text-[#8a9bb5]">
                        {node.xp_reward} XP
                      </span>
                    </div>
                  </div>
                  {cfg.label && (
                    <Link
                      href={`/learn/${projectId}/${node.id}`}
                      className="px-4 py-1.5 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] text-sm font-medium transition-colors"
                    >
                      {cfg.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [progress, setProgress] = useState<NodeProgress[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMilestone, setOpenMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push(`/login?redirect=/my-projects/${id}`);
      return;
    }

    const projectId = parseInt(id);
    Promise.all([
      getProject(projectId),
      getProjectProgress(projectId),
      getProgressSummary(projectId),
    ])
      .then(([proj, prog, summ]) => {
        setProject(proj);
        setProgress(prog);
        setSummary(summ);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading || !project) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
        <Stars />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-[#8a9bb5] text-lg">
            {loading ? "Loading..." : "Project not found"}
          </div>
        </div>
      </main>
    );
  }

  const nodeProgressMap = new Map(progress.map((p) => [p.knode, p]));
  const percent = summary?.progress_percent || 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 px-4 py-8 page-enter">
        <div className="max-w-4xl mx-auto pt-14">
          <Link
            href="/my-projects"
            className="inline-flex items-center text-[#8a9bb5] hover:text-white transition-colors text-sm mb-8"
          >
            ← Back to My Projects
          </Link>

          {/* Project header */}
          <div className="mb-8">
            <span className="text-xs tracking-widest text-[#8a9bb5] uppercase">
              {project.subtitle || project.category.toUpperCase()}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-2 title-3d">
              {project.title}
            </h1>
          </div>

          {/* Progress bar */}
          <div className="mb-10 bg-[#1a2535]/80 rounded-2xl border border-[#3a4a60]/30 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#c0cde0] font-semibold">
                Quest Progress
              </span>
              <span className="text-[#b8a0d8] text-sm font-medium">
                {percent}%
              </span>
            </div>
            <div className="h-3 bg-[#1a2030] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#b8a0d8] to-[#8ac0e8] rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-[#6a7b8f]">
              <span>
                {summary?.passed_knodes || 0}/{summary?.total_knodes || 0} nodes
                completed
              </span>
              {summary?.total_xp_earned ? (
                <span>{summary.total_xp_earned} XP earned</span>
              ) : null}
            </div>
          </div>

          {/* Milestones */}
          <h2 className="text-xl font-bold text-[#c0cde0] mb-6">
            Quest Milestones
          </h2>

          <div className="space-y-4">
            {project.milestones
              .sort((a, b) => a.order - b.order)
              .map((milestone, idx) => (
                <MilestoneAccordion
                  key={milestone.id}
                  milestone={milestone}
                  index={idx}
                  isOpen={openMilestone === idx}
                  onToggle={() =>
                    setOpenMilestone(openMilestone === idx ? null : idx)
                  }
                  nodeProgressMap={nodeProgressMap}
                  projectId={project.id}
                />
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}

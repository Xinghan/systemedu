"use client";

import { useState } from "react";
import Link from "next/link";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";
import type { ProjectDetail, Milestone } from "@/lib/types";

const difficultyLabels: Record<string, string> = {
  "1": "Beginner",
  "2": "Elementary",
  "3": "Intermediate",
  "4": "Advanced",
  "5": "Expert",
};

const contentTypeIcons: Record<string, string> = {
  concept: "📖",
  tutorial: "🎯",
  exercise: "✏️",
  project: "🛠️",
  quiz: "📝",
};

function MilestoneCard({
  milestone,
  index,
  isOpen,
  onToggle,
}: {
  milestone: Milestone;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
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
          <div className="ml-14 border-t border-[#3a4a60]/50 pt-4">
            {milestone.acceptance_criteria && (
              <div className="mb-4 bg-[#1a2535]/80 rounded-lg p-3 border border-[#3a4a60]/30">
                <p className="text-xs text-[#6a7b8f] uppercase tracking-wider mb-1">
                  Completion Criteria
                </p>
                <p className="text-[#8a9bb5] text-sm">
                  {milestone.acceptance_criteria}
                </p>
              </div>
            )}

            {milestone.knodes.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6a7b8f] uppercase tracking-wider">
                  Knowledge Nodes ({milestone.knodes.length})
                </p>
                {milestone.knodes.map((node) => (
                  <div
                    key={node.id}
                    className="bg-[#1a2535]/80 rounded-lg p-3 border border-[#3a4a60]/30 flex items-start gap-3"
                  >
                    <span className="text-lg flex-shrink-0">
                      {contentTypeIcons[node.content_type] || "📄"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[#c0cde0] font-medium text-sm">
                        {node.title}
                      </h4>
                      {node.summary && (
                        <p className="text-[#6a7b8f] text-xs mt-1">
                          {node.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[#5a6b7f]">
                          {difficultyLabels[node.difficulty_level] || `Lv.${node.difficulty_level}`}
                        </span>
                        <span className="text-xs text-[#5a6b7f]">
                          ~{node.estimated_minutes}min
                        </span>
                        <span className="text-xs text-[#8a9bb5]">
                          {node.xp_reward} XP
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#5a6b7f] text-sm italic">
                No knowledge nodes yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectContent({
  project,
}: {
  project: ProjectDetail;
}) {
  const [openMilestone, setOpenMilestone] = useState<number | null>(null);

  const totalXP = project.milestones.reduce(
    (sum, m) => sum + m.xp_reward + m.knodes.reduce((s, k) => s + k.xp_reward, 0),
    0
  );
  const totalNodes = project.milestones.reduce(
    (sum, m) => sum + m.knodes.length,
    0
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 px-4 py-8 page-enter">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-[#8a9bb5] hover:text-white transition-colors text-sm mb-8"
          >
            ← Back to Projects
          </Link>

          {/* Project header */}
          <div className="mb-8">
            <span className="text-xs tracking-widest text-[#8a9bb5] uppercase">
              {project.subtitle || project.category.toUpperCase()}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-2 title-3d">
              {project.title}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-[#6a7b8f]">
              <span>{project.milestones.length} milestones</span>
              <span>·</span>
              <span>{totalNodes} knowledge nodes</span>
              <span>·</span>
              <span>{totalXP} total XP</span>
              <span>·</span>
              <span>~{project.estimated_hours}h</span>
            </div>
          </div>

          {/* Alien teacher intro */}
          <div className="flex items-start gap-6 mb-12">
            <div className="flex-shrink-0">
              <AlienTeacher size={110} message={project.description} />
            </div>
          </div>

          {/* Milestones */}
          <h2 className="text-xl font-bold text-[#c0cde0] mb-6">
            Quest Milestones
          </h2>

          {project.milestones.length > 0 ? (
            <div className="space-y-4">
              {project.milestones
                .sort((a, b) => a.order - b.order)
                .map((milestone, idx) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    index={idx}
                    isOpen={openMilestone === idx}
                    onToggle={() =>
                      setOpenMilestone(openMilestone === idx ? null : idx)
                    }
                  />
                ))}
            </div>
          ) : (
            <div className="bg-[#1a2535]/80 rounded-xl border border-[#3a4a60]/30 p-8 text-center">
              <p className="text-[#8a9bb5]">
                Milestones are being prepared for this project.
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-12 bg-[#1a2535]/80 rounded-2xl border border-[#3a4a60]/30 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#c0cde0] font-semibold">
                Quest Progress
              </span>
              <span className="text-[#b8a0d8] text-sm">0%</span>
            </div>
            <div className="h-3 bg-[#1a2030] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#b8a0d8] to-[#8ac0e8] rounded-full transition-all duration-500"
                style={{ width: "0%" }}
              />
            </div>
            <p className="text-[#5a6b7f] text-xs mt-2">
              Complete modules to fill your progress bar and earn badges!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

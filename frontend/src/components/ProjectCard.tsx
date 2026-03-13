"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";

const categoryColors: Record<string, string> = {
  ai: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  biotech: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  aerospace: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  music: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  climate: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  robotics: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  chemistry: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  math: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  cs: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

export default function ProjectCard({ project }: { project: Project }) {
  const badgeClass =
    categoryColors[project.category] ||
    "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <Link href={`/project/${project.id}`}>
      <div className="quest-card rounded-2xl border border-[#3a4a60]/50 bg-[#1a2535]/80 backdrop-blur-sm p-6 cursor-pointer hover:border-[#b8a0d8]/40 transition-all duration-300 hover:scale-[1.02] h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${badgeClass}`}
          >
            {project.category.toUpperCase()}
          </span>
          <span className="text-xs text-[#5a6b7f]">
            Ages {project.min_age}-{project.max_age}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{project.title}</h3>

        {project.subtitle && (
          <p className="text-[#7a8b9f] text-sm mb-3 line-clamp-2">
            {project.subtitle}
          </p>
        )}

        <p className="text-[#6a7b8f] text-sm mb-4 line-clamp-2 flex-1">
          {project.description}
        </p>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#3a4a60]/30">
          <div className="flex items-center gap-3 text-xs text-[#6a7b8f]">
            <span>{project.milestone_count} milestones</span>
            <span>~{project.estimated_hours}h</span>
            {project.fork_count > 0 && (
              <span>{project.fork_count} learners</span>
            )}
          </div>
          <span className="text-sm text-[#b8a0d8] font-medium">
            View Quest →
          </span>
        </div>
      </div>
    </Link>
  );
}

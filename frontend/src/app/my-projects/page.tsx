"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";
import { getMyProjects } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { MyProject } from "@/lib/types";

const categoryColors: Record<string, string> = {
  ai: "bg-cyan-500/20 text-cyan-300",
  biotech: "bg-emerald-500/20 text-emerald-300",
  aerospace: "bg-violet-500/20 text-violet-300",
  music: "bg-amber-500/20 text-amber-300",
  climate: "bg-orange-500/20 text-orange-300",
  robotics: "bg-rose-500/20 text-rose-300",
};

function ProjectCard({ project }: { project: MyProject }) {
  const badgeClass =
    categoryColors[project.category] || "bg-gray-500/20 text-gray-300";

  return (
    <Link href={`/my-projects/${project.id}`}>
      <div className="quest-card rounded-2xl border border-[#3a4a60]/50 bg-[#1a2535]/80 backdrop-blur-sm p-6 cursor-pointer hover:border-[#b8a0d8]/40 transition-all duration-300 hover:scale-[1.02] h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
            {project.category.toUpperCase()}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{project.title}</h3>

        <p className="text-[#6a7b8f] text-xs mb-4">
          from: {project.forked_from_title}
        </p>

        {/* Progress bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8a9bb5]">
              {project.passed_knodes}/{project.total_knodes} nodes
            </span>
            <span className="text-xs text-[#b8a0d8] font-medium">
              {project.progress_percent}%
            </span>
          </div>
          <div className="h-2 bg-[#1a2030] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#b8a0d8] to-[#8ac0e8] rounded-full transition-all duration-500"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MyProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login?redirect=/my-projects");
      return;
    }

    getMyProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
        <Stars />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-[#8a9bb5] text-lg">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 px-4 py-8 page-enter">
        <div className="max-w-6xl mx-auto pt-14">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white title-3d mb-2">
            My Projects
          </h1>
          <p className="text-[#8a9bb5] mb-8">
            Your learning quests and progress
          </p>

          {projects.length === 0 ? (
            <div className="text-center py-16">
              <AlienTeacher
                size={120}
                message="No quests yet! Head to the Challenge Hall to start your first adventure!"
              />
              <Link
                href="/challenges"
                className="inline-block mt-8 px-8 py-3 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold transition-colors"
              >
                Browse Challenge Hall
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

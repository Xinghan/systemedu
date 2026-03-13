"use client";

import { useState, useEffect } from "react";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";
import CategoryFilter from "@/components/CategoryFilter";
import ProjectCard from "@/components/ProjectCard";
import { getProjects } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function ChallengeHall({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const [projects] = useState<Project[]>(initialProjects);
  const [category, setCategory] = useState("all");
  const [showAlien, setShowAlien] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlien(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const filtered =
    category === "all"
      ? projects
      : projects.filter((p) => p.category === category);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 px-4 py-8 page-enter">
        <div className="max-w-6xl mx-auto pt-14">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white title-3d">
              Challenge Hall
            </h1>
            <p className="text-[#8a9bb5] mt-2">
              Choose a real-world project to master. Each quest is a journey!
            </p>
          </div>

          {/* Alien Teacher */}
          {showAlien && (
            <div className="flex items-start gap-6 mb-8 page-enter">
              <div className="flex-shrink-0">
                <AlienTeacher
                  size={90}
                  message="Welcome, explorer! Pick a quest that excites you. I'll guide you through every step!"
                />
              </div>
            </div>
          )}

          {/* Category Filter */}
          <div className="mb-8">
            <CategoryFilter selected={category} onChange={setCategory} />
          </div>

          {/* Project Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-[#6a7b8f] text-lg">
                No projects in this category yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

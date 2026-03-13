"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlienTeacher from "@/components/AlienTeacher";
import Planet from "@/components/Planet";
import Stars from "@/components/Stars";
import type { Project } from "@/lib/types";

// Map category to color scheme
function getCategoryStyle(category: string) {
  const map: Record<string, { borderColor: string; subtitle: string }> = {
    ai: { borderColor: "border-cyan-500/40", subtitle: "ARTIFICIAL INTELLIGENCE" },
    medicine: { borderColor: "border-emerald-500/40", subtitle: "MEDICAL AI" },
    climate: { borderColor: "border-amber-500/40", subtitle: "CLIMATE SCIENCE" },
    space: { borderColor: "border-violet-500/40", subtitle: "SPACE EXPLORATION" },
    robotics: { borderColor: "border-rose-500/40", subtitle: "ROBOTICS" },
    biology: { borderColor: "border-green-500/40", subtitle: "BIOLOGY" },
  };
  return map[category] || { borderColor: "border-blue-500/40", subtitle: category.toUpperCase() };
}

export default function ProjectCarousel({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAlien, setShowAlien] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlien(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (projects.length === 0) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
        <Stars />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <AlienTeacher size={140} message="Projects are being prepared! Check back soon." />
            </div>
            <h1 className="text-4xl font-bold title-3d mt-8">Coming Soon</h1>
            <p className="text-[#8a9bb5] mt-3">
              Our team is crafting amazing learning projects for you.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const project = projects[activeIndex];
  const style = getCategoryStyle(project.category);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 min-h-screen flex page-enter">
        {/* Left side: Planet + Alien */}
        <div className="relative w-full md:w-[55%] min-h-screen flex items-end justify-center">
          <div className="absolute bottom-[-180px] left-[-80px] md:left-[-40px]">
            <Planet size={680} />
          </div>

          {showAlien && (
            <div
              className="absolute z-20"
              style={{ bottom: "280px", left: "180px" }}
            >
              <AlienTeacher size={160} showBubble={false} />
            </div>
          )}
        </div>

        {/* Right side: Content */}
        <div className="absolute right-0 top-0 w-full md:w-[50%] min-h-screen flex flex-col items-center md:items-start justify-center px-8 md:px-16">
          <div className="mb-6">
            <span className="inline-block px-5 py-2 rounded-full bg-[#2a3548]/80 text-[#a0b0c5] text-sm tracking-widest uppercase border border-[#3a4a60]/50">
              {project.subtitle || style.subtitle}
            </span>
          </div>

          <h1 className="title-3d text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] mb-8 text-center md:text-left">
            {project.title.split(" ").length > 1 ? (
              <>
                {project.title.split(" ").slice(0, -1).join(" ")}
                <br />
                {project.title.split(" ").slice(-1)}
              </>
            ) : (
              project.title
            )}
          </h1>

          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setActiveIndex(
                  (activeIndex - 1 + projects.length) % projects.length
                )
              }
              className="w-12 h-12 rounded-full border-2 border-[#4a5a6f] text-[#8a9bb5] hover:border-white hover:text-white transition-all flex items-center justify-center text-xl cursor-pointer"
            >
              ‹
            </button>

            <button
              onClick={() => router.push("/challenges")}
              className="px-8 py-3 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold text-lg transition-colors cursor-pointer shadow-lg shadow-[#b8a0d8]/20"
            >
              Start Quest
            </button>

            <button
              onClick={() =>
                setActiveIndex((activeIndex + 1) % projects.length)
              }
              className="w-12 h-12 rounded-full border-2 border-[#4a5a6f] text-[#8a9bb5] hover:border-white hover:text-white transition-all flex items-center justify-center text-xl cursor-pointer"
            >
              ›
            </button>
          </div>

          <div className="flex gap-2 mt-6">
            {projects.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === activeIndex
                    ? "bg-[#b8a0d8] scale-125"
                    : "bg-[#3a4a60] hover:bg-[#5a6a7f]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-20">
        <button className="px-4 py-2 rounded-full bg-[#2a3548]/60 border border-[#3a4a60]/50 text-[#8a9bb5] text-sm hover:text-white transition-colors cursor-pointer backdrop-blur-sm">
          Resources & more
        </button>
      </div>
    </main>
  );
}

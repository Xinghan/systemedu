"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AlienTeacher from "@/components/AlienTeacher";
import Planet from "@/components/Planet";
import Stars from "@/components/Stars";

const quests = [
  {
    id: "ai-basics",
    title: "AI Fundamentals",
    subtitle: "PATTERN RECOGNITION",
    description: "Learn how machines think, recognize patterns, and make decisions",
    color: "from-cyan-500 to-blue-600",
    borderColor: "border-cyan-500/40",
    difficulty: "Beginner",
    modules: 5,
  },
  {
    id: "medicine",
    title: "AI in Medicine",
    subtitle: "DISEASE DETECTION",
    description: "Discover how AI detects diseases, reads scans, and saves lives",
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/40",
    difficulty: "Intermediate",
    modules: 4,
  },
  {
    id: "climate",
    title: "Climate & Earth",
    subtitle: "FLOOD FORECASTING",
    description: "Explore how AI predicts weather, tracks forests, and fights climate change",
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-500/40",
    difficulty: "Beginner",
    modules: 4,
  },
  {
    id: "space",
    title: "Space Exploration",
    subtitle: "EXOPLANET DISCOVERY",
    description: "Journey through the cosmos with AI-powered telescopes and rovers",
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/40",
    difficulty: "Advanced",
    modules: 6,
  },
];

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [activeQuest, setActiveQuest] = useState(0);
  const [showAlien, setShowAlien] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlien(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (entered) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <Stars />
        <div className="relative z-10 min-h-screen px-4 py-12 page-enter">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold title-3d">
                  Choose Your Quest
                </h2>
                <p className="text-[#8a9bb5] mt-1">
                  Each quest is an adventure in a new field of knowledge
                </p>
              </div>
              <button
                onClick={() => setEntered(false)}
                className="text-[#8a9bb5] hover:text-white transition-colors text-sm cursor-pointer"
              >
                ← Back
              </button>
            </div>

            <div className="flex items-start gap-6 mb-12">
              <div className="flex-shrink-0">
                <AlienTeacher size={90} speaking showBubble={false} />
              </div>
              <div className="speech-bubble bg-[#2a3548]/80 border border-[#3a4a60] rounded-2xl px-5 py-3 backdrop-blur-sm">
                <p className="text-[#c0cde0] text-base">
                  Pick a quest to begin! Each one will teach you how AI is
                  changing the world. I&apos;ll be with you every step of the way!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quests.map((quest) => (
                <Link key={quest.id} href={`/quest/${quest.id}`}>
                  <div
                    className={`quest-card rounded-2xl border ${quest.borderColor} bg-[#1a2535]/80 backdrop-blur-sm p-6 cursor-pointer`}
                  >
                    <div className="flex-1">
                      <span className="text-xs tracking-widest text-[#8a9bb5] uppercase">
                        {quest.subtitle}
                      </span>
                      <h3 className="text-2xl font-bold text-white mt-1">
                        {quest.title}
                      </h3>
                      <p className="text-[#7a8b9f] mt-2 text-sm">
                        {quest.description}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-[#6a7b8f]">
                          {quest.modules} modules · {quest.difficulty}
                        </span>
                        <span className="text-sm text-[#b8a9d4] font-medium">
                          Start Quest →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const quest = quests[activeQuest];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 min-h-screen flex page-enter">
        {/* Left side: Planet + Alien */}
        <div className="relative w-full md:w-[55%] min-h-screen flex items-end justify-center">
          {/* Planet - positioned at bottom left, overflowing down */}
          <div className="absolute bottom-[-180px] left-[-80px] md:left-[-40px]">
            <Planet size={680} />
          </div>

          {/* Alien standing on top of the planet */}
          {showAlien && (
            <div
              className="absolute z-20"
              style={{
                bottom: "280px",
                left: "180px",
              }}
            >
              <AlienTeacher size={160} showBubble={false} />
            </div>
          )}
        </div>

        {/* Right side: Content */}
        <div className="absolute right-0 top-0 w-full md:w-[50%] min-h-screen flex flex-col items-center md:items-start justify-center px-8 md:px-16">
          {/* Quest category pill */}
          <div className="mb-6">
            <span className="inline-block px-5 py-2 rounded-full bg-[#2a3548]/80 text-[#a0b0c5] text-sm tracking-widest uppercase border border-[#3a4a60]/50">
              {quest.subtitle}
            </span>
          </div>

          {/* Title */}
          <h1 className="title-3d text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] mb-8 text-center md:text-left">
            {quest.title.split(" ").length > 1 ? (
              <>
                {quest.title.split(" ").slice(0, -1).join(" ")}
                <br />
                {quest.title.split(" ").slice(-1)}
              </>
            ) : (
              quest.title
            )}
          </h1>

          {/* Navigation buttons */}
          <div className="flex items-center gap-4">
            {/* Prev */}
            <button
              onClick={() =>
                setActiveQuest(
                  (activeQuest - 1 + quests.length) % quests.length
                )
              }
              className="w-12 h-12 rounded-full border-2 border-[#4a5a6f] text-[#8a9bb5] hover:border-white hover:text-white transition-all flex items-center justify-center text-xl cursor-pointer"
            >
              ‹
            </button>

            {/* Start Quest */}
            <button
              onClick={() => setEntered(true)}
              className="px-8 py-3 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold text-lg transition-colors cursor-pointer shadow-lg shadow-[#b8a0d8]/20"
            >
              Start Quest
            </button>

            {/* Next */}
            <button
              onClick={() =>
                setActiveQuest((activeQuest + 1) % quests.length)
              }
              className="w-12 h-12 rounded-full border-2 border-[#4a5a6f] text-[#8a9bb5] hover:border-white hover:text-white transition-all flex items-center justify-center text-xl cursor-pointer"
            >
              ›
            </button>
          </div>

          {/* Quest dots */}
          <div className="flex gap-2 mt-6">
            {quests.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuest(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === activeQuest
                    ? "bg-[#b8a0d8] scale-125"
                    : "bg-[#3a4a60] hover:bg-[#5a6a7f]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Resources link - bottom left */}
      <div className="absolute bottom-4 left-4 z-20">
        <button className="px-4 py-2 rounded-full bg-[#2a3548]/60 border border-[#3a4a60]/50 text-[#8a9bb5] text-sm hover:text-white transition-colors cursor-pointer backdrop-blur-sm">
          Resources & more
        </button>
      </div>

      {/* Sound toggle - top right */}
      <div className="absolute top-4 right-4 z-20">
        <button className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-[#1e2a3a] hover:bg-white transition-colors cursor-pointer shadow-md">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        </button>
      </div>
    </main>
  );
}

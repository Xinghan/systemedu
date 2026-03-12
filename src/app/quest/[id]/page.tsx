"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";

interface Module {
  title: string;
  description: string;
  icon: string;
}

interface QuestData {
  title: string;
  subtitle: string;
  intro: string;
  modules: Module[];
}

const questData: Record<string, QuestData> = {
  "ai-basics": {
    title: "AI Fundamentals",
    subtitle: "PATTERN RECOGNITION",
    intro:
      "Welcome to your first quest! We'll explore how AI works from the ground up. I'll teach you about data, patterns, and how machines learn — no coding needed!",
    modules: [
      { title: "What is AI?", description: "Understand the difference between AI, machine learning, and deep learning", icon: "🧠" },
      { title: "Data is Everything", description: "Learn to collect, clean, and prepare data for training", icon: "📊" },
      { title: "Training Your First Model", description: "Use an interactive tool to train an image classifier", icon: "🎯" },
      { title: "Testing & Bias", description: "Discover why AI can be wrong and how to spot bias", icon: "⚖️" },
      { title: "AI in the Real World", description: "See how AI is used in everyday apps and services", icon: "🌐" },
    ],
  },
  medicine: {
    title: "AI in Medicine",
    subtitle: "DISEASE DETECTION",
    intro:
      "On this quest, you'll discover how AI is revolutionizing healthcare! From reading X-rays to predicting diseases, AI is helping doctors save more lives every day.",
    modules: [
      { title: "AI Meets Healthcare", description: "Overview of how AI is transforming modern medicine", icon: "🏥" },
      { title: "Reading Medical Images", description: "Train an AI to detect patterns in X-rays and retinal scans", icon: "🔬" },
      { title: "Drug Discovery", description: "Learn how AI accelerates finding new medicines", icon: "💊" },
      { title: "Ethics in Medical AI", description: "Explore the critical questions of trust, privacy, and fairness", icon: "🤝" },
    ],
  },
  climate: {
    title: "Climate & Earth",
    subtitle: "FLOOD FORECASTING",
    intro:
      "Our planet needs help, and AI is a powerful ally! In this quest, you'll learn how researchers use AI to forecast floods, monitor deforestation, and fight climate change.",
    modules: [
      { title: "Predicting Floods", description: "Build a model that forecasts flood risks using weather data", icon: "🌊" },
      { title: "Tracking Forests", description: "Use satellite imagery and AI to monitor deforestation", icon: "🌳" },
      { title: "Clean Energy", description: "Discover how AI optimizes solar and wind power systems", icon: "⚡" },
      { title: "Your Climate Action", description: "Design your own AI-powered solution for an environmental challenge", icon: "💡" },
    ],
  },
  space: {
    title: "Space Exploration",
    subtitle: "EXOPLANET DISCOVERY",
    intro:
      "The cosmos is calling! Join me on an adventure through the stars where AI helps us discover new planets, navigate Mars rovers, and unravel the mysteries of the universe!",
    modules: [
      { title: "Eyes in the Sky", description: "How AI processes data from space telescopes like James Webb", icon: "🔭" },
      { title: "Mars Rover Navigator", description: "Guide a virtual rover across Mars terrain using AI pathfinding", icon: "🤖" },
      { title: "Finding Exoplanets", description: "Use machine learning to detect planets around distant stars", icon: "🪐" },
      { title: "Mapping the Universe", description: "Explore how AI classifies millions of galaxies", icon: "✨" },
      { title: "Space Communications", description: "Learn how AI compresses and repairs signals across light-years", icon: "📡" },
      { title: "The Future of Space AI", description: "Imagine the next frontier of autonomous space exploration", icon: "🛸" },
    ],
  },
};

export default function QuestPage() {
  const { id } = useParams<{ id: string }>();
  const quest = questData[id];
  const [activeModule, setActiveModule] = useState<number | null>(null);

  if (!quest) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-[#1e2a3a]">
        <Stars />
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold text-[#c0cde0] mb-4">Quest Not Found</h1>
          <Link href="/" className="text-[#b8a0d8] hover:text-white transition-colors">
            ← Return to Base
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 px-4 py-8 page-enter">
        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <Link
            href="/"
            className="inline-flex items-center text-[#8a9bb5] hover:text-white transition-colors text-sm mb-8"
          >
            ← Back to Quests
          </Link>

          {/* Quest header */}
          <div className="mb-8">
            <span className="text-xs tracking-widest text-[#8a9bb5] uppercase">
              {quest.subtitle}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-2 title-3d">
              {quest.title}
            </h1>
            <p className="text-[#6a7b8f] text-sm mt-2">
              {quest.modules.length} modules
            </p>
          </div>

          {/* Alien teacher intro */}
          <div className="flex items-start gap-6 mb-12">
            <div className="flex-shrink-0">
              <AlienTeacher size={110} message={quest.intro} />
            </div>
          </div>

          {/* Modules list */}
          <h2 className="text-xl font-bold text-[#c0cde0] mb-6">
            Quest Modules
          </h2>

          <div className="space-y-4">
            {quest.modules.map((mod, idx) => (
              <div
                key={idx}
                onClick={() =>
                  setActiveModule(activeModule === idx ? null : idx)
                }
                className={`rounded-xl border cursor-pointer transition-all duration-300 ${
                  activeModule === idx
                    ? "border-[#b8a0d8]/60 bg-[#2a2540]/40 shadow-lg shadow-[#b8a0d8]/10"
                    : "border-[#3a4a60]/50 bg-[#1a2535]/60 hover:border-[#4a5a70]"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      activeModule === idx
                        ? "bg-[#b8a0d8] text-[#1a1a2e]"
                        : "bg-[#2a3548] text-[#8a9bb5]"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <span className="text-2xl">{mod.icon}</span>

                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{mod.title}</h3>
                    <p className="text-[#6a7b8f] text-sm">
                      {mod.description}
                    </p>
                  </div>

                  <span
                    className={`text-[#6a7b8f] transition-transform duration-300 ${
                      activeModule === idx ? "rotate-90" : ""
                    }`}
                  >
                    ▶
                  </span>
                </div>

                {activeModule === idx && (
                  <div className="px-4 pb-4 pt-0 page-enter">
                    <div className="ml-14 border-t border-[#3a4a60]/50 pt-4">
                      <div className="bg-[#1a2535]/80 rounded-lg p-4 border border-[#3a4a60]/30">
                        <p className="text-[#8a9bb5] text-sm mb-4">
                          This module is coming soon! In the full version,
                          you&apos;ll find interactive lessons, hands-on
                          activities, and quizzes here.
                        </p>
                        <div className="flex gap-3">
                          <button className="px-4 py-2 rounded-lg bg-[#b8a0d8] text-[#1a1a2e] text-sm font-medium hover:bg-[#c8b0e8] transition-colors cursor-pointer">
                            Start Module
                          </button>
                          <button className="px-4 py-2 rounded-lg border border-[#3a4a60] text-[#8a9bb5] text-sm hover:bg-[#2a3548] transition-colors cursor-pointer">
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

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

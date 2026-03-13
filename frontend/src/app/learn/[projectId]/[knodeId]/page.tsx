"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlienTeacher from "@/components/AlienTeacher";
import Stars from "@/components/Stars";
import { isLoggedIn } from "@/lib/auth";

export default function LearnPage({
  params,
}: {
  params: Promise<{ projectId: string; knodeId: string }>;
}) {
  const { projectId, knodeId } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push(`/login?redirect=/learn/${projectId}/${knodeId}`);
    }
  }, [projectId, knodeId, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <AlienTeacher
          size={140}
          message="Learning module coming soon! I'm preparing amazing content for you."
        />

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            Learning Workbench
          </h1>
          <p className="text-[#8a9bb5] mb-8 max-w-md">
            This is where you&apos;ll interact with your AI tutor, complete
            exercises, and master each knowledge node. Coming soon!
          </p>

          <Link
            href={`/my-projects/${projectId}`}
            className="inline-block px-8 py-3 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold transition-colors"
          >
            ← Back to Project
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import type { ProjectDetail } from "@/lib/types";
import ProjectContent from "./ProjectContent";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020";

async function getProject(id: string): Promise<ProjectDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/projects/${id}/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-[#1e2a3a]">
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold text-[#c0cde0] mb-4">
            Project Not Found
          </h1>
          <Link
            href="/"
            className="text-[#b8a0d8] hover:text-white transition-colors"
          >
            ← Return to Home
          </Link>
        </div>
      </main>
    );
  }

  return <ProjectContent project={project} />;
}

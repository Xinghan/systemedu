import ProjectCarousel from "@/components/ProjectCarousel";
import type { Project } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020";

async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch(`${API_BASE}/api/projects/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const projects = await getProjects();

  return <ProjectCarousel projects={projects} />;
}

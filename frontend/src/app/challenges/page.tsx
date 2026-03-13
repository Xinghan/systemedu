import { fetchServer } from "@/lib/api";
import type { Project } from "@/lib/types";
import ChallengeHall from "./ChallengeHall";

export default async function ChallengesPage() {
  let projects: Project[] = [];
  try {
    projects = await fetchServer<Project[]>("/api/projects/");
  } catch {
    // Fall back to empty list
  }

  return <ChallengeHall initialProjects={projects} />;
}

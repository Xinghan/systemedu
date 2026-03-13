"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getActiveTasks } from "@/lib/api";
import type { ActiveTask } from "@/lib/types";

function formatDuration(start: string | null): string {
  if (!start) return "";
  const seconds = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export default function TaskIndicator() {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await getActiveTasks();
        setTasks(result);
      } catch {
        // Ignore
      }
    }
    fetch();
    intervalRef.current = setInterval(fetch, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Force re-render every second to update durations
  const [, setTick] = useState(0);
  useEffect(() => {
    if (tasks.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [tasks.length]);

  if (tasks.length === 0) return null;

  return (
    <div className="px-3 py-2 relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
        </span>
        Tasks ({tasks.length})
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {tasks.map((task) => (
            <Link
              key={task.task_id}
              href={`/projects/${task.project_id}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 hover:bg-bg-elevated transition-colors border-b border-border last:border-0"
            >
              <p className="text-xs font-medium text-text-primary truncate">
                {task.project_title}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {task.granularity} &middot; {task.status === "running" ? "Running" : "Queued"}
                {task.started_at && ` &middot; ${formatDuration(task.started_at)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

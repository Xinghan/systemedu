"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getActiveTasks, getTaskStatus } from "@/lib/api";
import { toast } from "./Toast";
import type { ActiveTask } from "@/lib/types";

interface TaskBannerProps {
  projectId: number;
  onTaskComplete: () => void;
}

function formatDuration(start: string | null): string {
  if (!start) return "";
  const seconds = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
  if (seconds < 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export default function TaskBanner({ projectId, onTaskComplete }: TaskBannerProps) {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdsRef = useRef<Set<string>>(new Set());

  // Tick every second to update duration display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (tasks.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [tasks.length]);

  const fetchTasks = useCallback(async () => {
    try {
      const activeTasks = await getActiveTasks(projectId);
      setTasks(activeTasks);

      // Check if any previously tracked tasks are now gone (completed)
      const currentIds = new Set(activeTasks.map((t) => t.task_id));
      for (const prevId of taskIdsRef.current) {
        if (!currentIds.has(prevId)) {
          // Task finished — check if it succeeded
          try {
            const status = await getTaskStatus(prevId);
            if (status.status === "completed") {
              const ms = status.milestones_created ?? 0;
              const kn = status.knodes_created ?? 0;
              toast(`Knowledge tree generated: ${ms} milestones, ${kn} nodes`);
              onTaskComplete();
            } else if (status.status === "failed") {
              toast(status.error || "Generation task failed", "error");
            }
          } catch {
            // Task may have been deleted
          }
        }
      }
      taskIdsRef.current = currentIds;
    } catch {
      // Silently ignore fetch errors
    }
  }, [projectId, onTaskComplete]);

  useEffect(() => {
    fetchTasks();
    intervalRef.current = setInterval(fetchTasks, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTasks]);

  if (tasks.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {tasks.map((task) => {
        const isRunning = task.status === "running";
        const timeRef = isRunning ? task.started_at : task.created_at;
        const duration = formatDuration(timeRef);

        return (
          <div
            key={task.task_id}
            className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3"
          >
            <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full flex-shrink-0" />
            <p className="text-sm text-text-primary">
              AI is generating knowledge tree ({task.granularity})...
            </p>
            <div className="flex items-center gap-2 ml-auto">
              {duration && (
                <span className="text-xs text-text-muted font-mono">{duration}</span>
              )}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isRunning
                    ? "bg-accent/20 text-accent"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {isRunning ? "Running" : "Queued"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

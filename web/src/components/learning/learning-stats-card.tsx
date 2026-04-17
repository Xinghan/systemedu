"use client"

import { useEffect, useState } from "react"
import {
  Target, TrendingUp, Clock, AlertTriangle, CheckCircle2, BarChart3, RefreshCw,
} from "lucide-react"
import { gateway } from "@/lib/api"
import type { ExerciseStatsResponse } from "@/lib/types/api"

interface LearningStatsCardProps {
  projectName: string
  userId?: string
}

function StatBox({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/40">
      <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${color || "bg-primary/10 text-primary"} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-extrabold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AccuracyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-10">{Math.round(value * 100)}%</span>
    </div>
  )
}

export function LearningStatsCard({ projectName, userId = "default" }: LearningStatsCardProps) {
  const [stats, setStats] = useState<ExerciseStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    gateway.getExerciseStats(projectName, { userId })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [projectName, userId])

  if (loading) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">学习情况</h2>
        </div>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          加载中...
        </div>
      </div>
    )
  }

  if (!stats || stats.total_attempts === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">学习情况</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-2">
          <Target className="h-8 w-8 opacity-30" />
          <p>还没有做题记录</p>
          <p className="text-xs">完成基础知识测试和练习题后，这里会显示学习数据</p>
        </div>
      </div>
    )
  }

  const weakCount = stats.weak_exercises.length
  const qtTheory = stats.per_quiz_type["theory"]
  const qtPractice = stats.per_quiz_type["practice"]

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">学习情况</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">
          共 {stats.total_attempts} 次答题
        </span>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatBox
          icon={<Target className="h-4 w-4" />}
          label="首次正确率"
          value={`${Math.round(stats.first_try_accuracy * 100)}%`}
          sub="第一次就答对的比例"
          color="bg-emerald-500/10 text-emerald-600"
        />
        <StatBox
          icon={<TrendingUp className="h-4 w-4" />}
          label="总体正确率"
          value={`${Math.round(stats.overall_accuracy * 100)}%`}
          sub="含重试后答对"
          color="bg-blue-500/10 text-blue-600"
        />
        <StatBox
          icon={<Clock className="h-4 w-4" />}
          label="平均用时"
          value={stats.avg_time_ms > 0 ? `${(stats.avg_time_ms / 1000).toFixed(1)}s` : "--"}
          sub="每题思考时间"
          color="bg-amber-500/10 text-amber-600"
        />
        <StatBox
          icon={<RefreshCw className="h-4 w-4" />}
          label="重试率"
          value={`${Math.round(stats.retry_rate * 100)}%`}
          sub="答错后重试的比例"
          color="bg-violet-500/10 text-violet-600"
        />
      </div>

      {/* Per quiz type accuracy bars */}
      {(qtTheory || qtPractice) && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">各类型首次正确率</p>
          {qtTheory && (
            <AccuracyBar
              label="基础知识"
              value={qtTheory.first_try_accuracy}
              color="bg-gradient-to-r from-teal-500 to-cyan-500"
            />
          )}
          {qtPractice && (
            <AccuracyBar
              label="练习题"
              value={qtPractice.first_try_accuracy}
              color="bg-gradient-to-r from-blue-500 to-indigo-500"
            />
          )}
          {stats.per_quiz_type["assignment"] && (
            <AccuracyBar
              label="作业题"
              value={stats.per_quiz_type["assignment"].first_try_accuracy}
              color="bg-gradient-to-r from-violet-500 to-purple-500"
            />
          )}
        </div>
      )}

      {/* Weak spots */}
      {weakCount > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-muted-foreground">
              薄弱知识点 ({weakCount})
            </p>
          </div>
          <div className="space-y-2">
            {stats.weak_exercises.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/10">
                <div className="flex-shrink-0 mt-0.5">
                  {w.eventually_correct ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{w.question}</p>
                  {w.error_analysis && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{w.error_analysis}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      尝试 {w.total_attempts} 次
                    </span>
                    {w.eventually_correct && (
                      <span className="text-[10px] text-emerald-600">已掌握</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-knode breakdown */}
      {Object.keys(stats.per_knode).length > 1 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">各节点正确率</p>
          <div className="space-y-1.5">
            {Object.entries(stats.per_knode)
              .sort(([, a], [, b]) => a.first_try_accuracy - b.first_try_accuracy)
              .map(([kid, s]) => (
                <AccuracyBar
                  key={kid}
                  label={`节点 ${kid}`}
                  value={s.first_try_accuracy}
                  color={
                    s.first_try_accuracy >= 0.8
                      ? "bg-emerald-500"
                      : s.first_try_accuracy >= 0.5
                        ? "bg-amber-500"
                        : "bg-red-400"
                  }
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

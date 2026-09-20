"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { getToken } from "@/lib/auth"
import { useAuthStore } from "@/lib/stores/auth-store"
import type { LearningBody, LearningScope } from "@/lib/api/learning-records"
import { LearningRecordSession } from "@/lib/learning-record-session"

function tokenSnapshot() { try { return getToken() } catch { return null } }
function subscribeAuth(listener: () => void) {
  const stop = useAuthStore.subscribe(listener)
  window.addEventListener("storage", listener)
  window.addEventListener("focus", listener)
  return () => { stop(); window.removeEventListener("storage", listener); window.removeEventListener("focus", listener) }
}
export function useLearningIdentity() {
  const token = useSyncExternalStore(subscribeAuth, tokenSnapshot, () => null)
  let owner = "guest"
  if (token) {
    try {
      // 仅用作缓存命名空间；后端独立校验签名与用户身份。
      const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
      const sub = JSON.parse(atob(part)).sub
      owner = typeof sub === "string" && sub ? `user:${sub}` : "invalid-session"
    } catch { owner = "invalid-session" }
  }
  return { token, owner }
}

export function useLearningRecord(scope: LearningScope, initial: LearningBody) {
  const identity = useLearningIdentity()
  const scopeJSON = JSON.stringify(scope), initialJSON = JSON.stringify(initial)
  const session = useMemo(() => new LearningRecordSession(identity.token, identity.owner, JSON.parse(scopeJSON), JSON.parse(initialJSON)), [identity.token, identity.owner, scopeJSON, initialJSON])
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.serverSnapshot)
  useEffect(() => { void session.start(); return () => session.dispose() }, [session])
  return { ...state, session, identity }
}

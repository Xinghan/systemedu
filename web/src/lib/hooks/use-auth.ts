"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getToken } from "@/lib/auth"

/**
 * Client-side auth guard. Redirects to /login if no token is present.
 * Use in layout components to protect route groups.
 */
export function useAuth() {
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
    }
  }, [router])
}

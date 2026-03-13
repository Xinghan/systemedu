"use client";

import { useState, useEffect, useCallback } from "react";
import { isLoggedIn, clearTokens } from "@/lib/auth";

export function useAuth() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setLoggedIn(false);
    window.location.href = "/login";
  }, []);

  return { loggedIn, loading, logout };
}

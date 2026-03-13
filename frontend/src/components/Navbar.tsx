"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isLoggedIn, clearTokens } from "@/lib/auth";
import { getProfile } from "@/lib/api";
import type { User } from "@/lib/types";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      setLoggedIn(true);
      getProfile()
        .then(setUser)
        .catch(() => {
          // Token expired or invalid
          clearTokens();
          setLoggedIn(false);
        });
    }
  }, []);

  function handleLogout() {
    clearTokens();
    setUser(null);
    setLoggedIn(false);
    router.refresh();
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1e2a3a]/80 backdrop-blur-md border-b border-[#3a4a60]/30">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl font-bold text-[#c8ddf0] group-hover:text-white transition-colors">
            SystemEdu
          </span>
          <span className="text-xs text-[#6a7b8f] hidden sm:inline">
            Learn by Doing
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Navigation links */}
          <Link
            href="/challenges"
            className="text-sm text-[#8a9bb5] hover:text-white transition-colors hidden sm:inline"
          >
            Challenge Hall
          </Link>
          {loggedIn && (
            <Link
              href="/my-projects"
              className="text-sm text-[#8a9bb5] hover:text-white transition-colors hidden sm:inline"
            >
              My Projects
            </Link>
          )}

          {/* User section */}
          {loggedIn && user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2a3548]/60 border border-[#3a4a60]/50">
                <span className="text-sm text-[#c0cde0]">
                  {user.display_name || user.username}
                </span>
                <span className="text-xs text-[#b8a0d8] font-medium">
                  {user.total_xp} XP
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-[#6a7b8f] hover:text-white transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : loggedIn ? (
            <div className="h-8 w-24 rounded-full bg-[#2a3548]/40 animate-pulse" />
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-[#8a9bb5] hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm px-4 py-1.5 rounded-full bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-medium transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

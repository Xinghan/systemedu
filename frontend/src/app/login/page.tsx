"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Stars from "@/components/Stars";
import AlienTeacher from "@/components/AlienTeacher";
import { login, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ username, password });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as Record<string, unknown> | null;
        setError(
          (data?.detail as string) || "Invalid username or password."
        );
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <AlienTeacher size={100} message="Welcome back, explorer!" />
          </div>

          <div className="bg-[#1a2535]/80 backdrop-blur-sm border border-[#3a4a60]/50 rounded-2xl p-8 mt-8">
            <h1 className="text-2xl font-bold text-white text-center mb-6">
              Sign In
            </h1>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* TODO: remove demo credentials before production */}
            <div className="mt-4 bg-[#2a3548]/60 border border-[#3a4a60]/40 rounded-lg px-4 py-3">
              <p className="text-xs text-[#6a7b8f] mb-1">Demo Account</p>
              <p className="text-sm text-[#8a9bb5]">
                Username: <span className="text-[#c0cde0] font-mono">demo</span>
                {" / "}
                Password: <span className="text-[#c0cde0] font-mono">demo1234</span>
              </p>
              <button
                type="button"
                onClick={() => { setUsername("demo"); setPassword("demo1234"); }}
                className="mt-2 text-xs text-[#b8a0d8] hover:text-white transition-colors cursor-pointer"
              >
                Auto-fill
              </button>
            </div>

            <p className="text-center text-[#6a7b8f] text-sm mt-6">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-[#b8a0d8] hover:text-white transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>

          <div className="text-center mt-4">
            <Link
              href="/"
              className="text-[#6a7b8f] hover:text-white transition-colors text-sm"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

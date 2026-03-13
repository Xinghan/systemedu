"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Stars from "@/components/Stars";
import AlienTeacher from "@/components/AlienTeacher";
import { register, login, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
    display_name: "",
    age: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (form.password !== form.password2) {
      setErrors({ password2: "Passwords do not match." });
      return;
    }

    setLoading(true);

    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        password2: form.password2,
        display_name: form.display_name || undefined,
        age: form.age ? parseInt(form.age) : undefined,
      });
      // Auto-login after registration
      await login({ username: form.username, password: form.password });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.data) {
        const fieldErrors: Record<string, string> = {};
        for (const [key, val] of Object.entries(err.data)) {
          fieldErrors[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ general: "Network error. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e2a3a]">
      <Stars />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <AlienTeacher
              size={100}
              message="Ready to start your adventure? Create an account!"
            />
          </div>

          <div className="bg-[#1a2535]/80 backdrop-blur-sm border border-[#3a4a60]/50 rounded-2xl p-8 mt-8">
            <h1 className="text-2xl font-bold text-white text-center mb-6">
              Create Account
            </h1>

            {errors.general && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Choose a username"
                />
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1">{errors.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => updateField("display_name", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="How should we call you?"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="your@email.com"
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Age
                </label>
                <input
                  type="number"
                  min={6}
                  max={99}
                  value={form.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Your age"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Create a password"
                />
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[#8a9bb5] mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={form.password2}
                  onChange={(e) => updateField("password2", e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0f1923] border border-[#3a4a60]/50 text-white placeholder-[#5a6b7f] focus:border-[#b8a0d8] focus:outline-none transition-colors"
                  placeholder="Confirm your password"
                />
                {errors.password2 && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.password2}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-[#b8a0d8] hover:bg-[#c8b0e8] text-[#1a1a2e] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="text-center text-[#6a7b8f] text-sm mt-6">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[#b8a0d8] hover:text-white transition-colors"
              >
                Sign in
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

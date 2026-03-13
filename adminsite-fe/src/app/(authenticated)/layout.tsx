"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import ToastContainer from "@/components/Toast";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedIn, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !loggedIn) {
      router.push("/login");
    }
  }, [loading, loggedIn, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!loggedIn) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar onLogout={logout} />
      <main className="ml-60 p-8">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}

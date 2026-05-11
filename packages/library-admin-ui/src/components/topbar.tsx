"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getUsername } from "@/lib/library-admin-api";

export default function TopBar() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  return (
    <header className="border-b border-border bg-card sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="font-semibold text-base">
            SystemEdu Library Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              项目
            </Link>
            <Link href="/projects/upload" className="hover:text-foreground">
              上传
            </Link>
            <Link href="/stats" className="hover:text-foreground">
              统计
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {username && <span className="text-muted-foreground">{username}</span>}
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}

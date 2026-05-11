"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LibraryBig, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clearToken, getUsername } from "@/lib/library-admin-api";

const NAV = [
  { href: "/projects", label: "项目" },
  { href: "/projects/upload", label: "上传" },
  { href: "/stats", label: "统计" },
];

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="flex items-center gap-2 font-semibold">
            <LibraryBig className="size-5 text-primary" />
            <span>Library Admin</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active =
                item.href === "/projects"
                  ? pathname === "/projects"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors",
                    active
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {username && (
            <span className="text-sm text-muted-foreground hidden sm:inline">{username}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" />
            退出
          </Button>
        </div>
      </div>
    </header>
  );
}

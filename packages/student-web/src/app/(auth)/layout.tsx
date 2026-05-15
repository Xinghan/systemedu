import Link from "next/link"
import { GraduationCap } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap size={18} />
            </span>
            <span>SystemEdu</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}

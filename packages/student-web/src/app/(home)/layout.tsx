import { StudentHeader } from "@/components/layout/student-header"

export default function HomeGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StudentHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}

import { StudentHeader } from "@/components/layout/student-header"

export default function LearnGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StudentHeader />
      <main>{children}</main>
    </div>
  )
}

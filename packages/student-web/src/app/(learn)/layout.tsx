import { StudentHeader } from "@/components/layout/student-header"

export default function LearnGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="app">
      <StudentHeader />
      {children}
    </div>
  )
}

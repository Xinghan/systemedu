import { StudentHeader } from "@/components/layout/student-header"

export default function HomeGroupLayout({
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

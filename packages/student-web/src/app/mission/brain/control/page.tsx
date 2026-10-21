import { Suspense } from "react"
import { RemainingMissionControl } from "@/components/mission/remaining-mission-control"
export default function Page() { return <Suspense fallback={<div role="status" className="flex min-h-80 items-center justify-center"><span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"/>正在打开任务站…</div>}><RemainingMissionControl id="brain"/></Suspense> }

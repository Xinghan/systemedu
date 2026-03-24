import { useAppStore } from "@/lib/stores/app-store"
import { getT } from "@/lib/i18n"

export function useT() {
  const locale = useAppStore((s) => s.locale)
  return getT(locale)
}

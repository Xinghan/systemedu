export const useSearchParams = () => new URLSearchParams(location.search)
export const usePathname = () => location.pathname
export const useRouter = () => ({ push: (s: string) => location.assign('https://systeme.xin'+s), replace: (s: string) => location.assign('https://systeme.xin'+s), refresh() {}, back: () => history.back() })

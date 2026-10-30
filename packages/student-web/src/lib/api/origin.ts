/** Browser API origins. Production defaults to the current site's nginx proxy. */
const defaultOrigin = process.env.NODE_ENV === "development" ? "http://localhost:18820" : ""

// Empty strings deliberately select same-origin URLs; explicit deployments can override them.
export const STUDENT_API_URL = process.env.NEXT_PUBLIC_STUDENT_API_URL ?? defaultOrigin
export const GATEWAY_API_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? defaultOrigin

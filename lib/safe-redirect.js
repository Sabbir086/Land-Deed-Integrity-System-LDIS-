// Only allow same-site relative paths (blocks open redirects like //evil.com or https://evil.com).
export function safeNext(next, fallback = "/dashboard") {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

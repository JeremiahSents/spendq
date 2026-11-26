export function money(n: number, opts: { compact?: boolean; cents?: boolean } = {}) {
  if (opts.compact && Math.abs(n) >= 10_000) {
    return `$${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
  }
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  })}`
}

export const perMonth = (n: number) => `${money(n)}/mo`
export const perYear = (n: number) => `${money(n)}/yr`

export function pct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`
}

export function signedPct(n: number) {
  const r = Math.round(n * 10) / 10
  return `${r > 0 ? "+" : ""}${r}%`
}

export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export type Currency = "USD" | "KES"

export const USD_TO_KES = 129
export const currencySymbol = (currency: Currency) => currency === "KES" ? "KES" : "$"
export const displayAmount = (usd: number, currency: Currency) => currency === "KES" ? usd * USD_TO_KES : usd
export const usdAmount = (amount: number, currency: Currency) => currency === "KES" ? amount / USD_TO_KES : amount

type MoneyOptions = { compact?: boolean; cents?: boolean }

export function money(usd: number, opts: MoneyOptions = {}, currency: Currency = "USD") {
  const n = displayAmount(usd, currency)
  const prefix = currency === "KES" ? "KES " : "$"
  const abs = Math.abs(n)
  if (opts.compact && abs >= 1_000) {
    const [divisor, unit]: [number, string] = abs >= 1_000_000_000 ? [1_000_000_000, "B"] : abs >= 1_000_000 ? [1_000_000, "M"] : [1_000, "k"]
    return prefix + (n / divisor).toLocaleString("en-US", { maximumFractionDigits: 1 }) + unit
  }
  return prefix + n.toLocaleString("en-US", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  })
}

export function moneyFormat(currency: Currency) {
  const format = (n: number, opts?: MoneyOptions) => money(n, opts, currency)
  return {
    money: format,
    perMonth: (n: number) => format(n) + "/mo",
    perYear: (n: number) => format(n) + "/yr",
    axisMoney: (n: number) => format(n, { compact: true }),
    moneyText: (text: string) => formatMoneyText(text, currency),
  }
}

/** Convert monetary amounts in existing evidence and saved analysis strings. */
export function formatMoneyText(text: string, currency: Currency) {
  return text.replace(/(\$|(?:USD|KES)\s+)(-?\d+(?:,\d{3})*(?:\.\d+)?)/g, (match, prefix: string, amount: string) => {
    const from = prefix.trim() === "KES" ? "KES" : "USD"
    if (from === currency) return match
    const converted = usdAmount(Number(amount.replaceAll(",", "")), from)
    return money(converted, { cents: amount.includes(".") }, currency)
  })
}

export const perMonth = (n: number) => money(n) + "/mo"
export const perYear = (n: number) => money(n) + "/yr"

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

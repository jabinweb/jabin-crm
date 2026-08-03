/** India statutory calculators with configurable PT bands. */

export type PtBand = { maxGross: number; amount: number }

export const DEFAULT_MH_PT_BANDS: PtBand[] = [
  { maxGross: 7500, amount: 0 },
  { maxGross: 10000, amount: 175 },
  { maxGross: Number.POSITIVE_INFINITY, amount: 200 },
]

export function calcPF(basic: number, enabled: boolean) {
  if (!enabled) return { employee: 0, employer: 0 }
  const wage = Math.min(basic, 15000)
  return {
    employee: Math.round(wage * 0.12),
    employer: Math.round(wage * 0.12),
  }
}

export function calcESI(gross: number, enabled: boolean) {
  if (!enabled || gross > 21000) return { employee: 0, employer: 0 }
  return {
    employee: Math.round(gross * 0.0075),
    employer: Math.round(gross * 0.0325),
  }
}

export function calcPT(
  gross: number,
  enabled: boolean,
  bands: PtBand[] = DEFAULT_MH_PT_BANDS
) {
  if (!enabled) return 0
  for (const band of bands) {
    if (gross <= band.maxGross) return band.amount
  }
  return bands[bands.length - 1]?.amount ?? 0
}

/** Manual override first; otherwise rough estimate labeled as estimate. */
export function calcTDS(taxableMonthly: number, configuredTax = 0) {
  if (configuredTax > 0) {
    return { amount: configuredTax, estimated: false }
  }
  if (taxableMonthly <= 50000) return { amount: 0, estimated: true }
  return {
    amount: Math.round((taxableMonthly - 50000) * 0.1),
    estimated: true,
  }
}

export function parsePtBandsFromSettings(settings: unknown): PtBand[] {
  if (!settings || typeof settings !== 'object') return DEFAULT_MH_PT_BANDS
  const pt = (settings as { ptBands?: PtBand[] }).ptBands
  if (!Array.isArray(pt) || pt.length === 0) return DEFAULT_MH_PT_BANDS
  return pt.map((b) => ({
    maxGross: Number(b.maxGross) || 0,
    amount: Number(b.amount) || 0,
  }))
}

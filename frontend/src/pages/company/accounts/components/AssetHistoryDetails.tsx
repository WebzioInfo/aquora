import type { ReactNode } from 'react'

export default function AssetHistoryDetails({ action, remarks, previousValue, newValue }: {
  action: string; remarks?: string; previousValue?: string; newValue?: string
}) {
  let details: ReactNode = remarks || newValue
  if (action === 'Depreciation Applied' && remarks) {
    try {
      const event: unknown = JSON.parse(remarks)
      if (typeof event === 'object' && event !== null && 'Percentage' in event && 'DepreciationAmount' in event &&
        typeof event.Percentage === 'number' && typeof event.DepreciationAmount === 'number') {
        const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
        details = <><span>{event.Percentage}% of {money(Number(previousValue))}: {money(event.DepreciationAmount)} depreciation. New book value: {money(Number(newValue))}.</span>
          {'Notes' in event && typeof event.Notes === 'string' && <span className="block">{event.Notes}</span>}</>
      }
    } catch { /* Preserve legacy human-readable history. */ }
  }
  return <p className="text-slate-600 mt-0.5">{details}</p>
}

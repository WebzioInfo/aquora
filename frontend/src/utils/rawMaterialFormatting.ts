/**
 * Centralized Raw Material Usage & Wastage Formatting Utility for Aquzio ERP
 *
 * The unit configured for each raw material in Inventory is the single source of truth.
 * Units are never derived from material categories or hardcoded.
 */

export function formatMaterialUnit(unit?: string | null): string {
  const u = (unit || '').trim();
  return u || '—';
}

export function formatRawMaterialQuantity(
  val: number | string | null | undefined,
  configuredUnit?: string | null
): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';

  const formattedNum = Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(4)).toString();
  const unit = (configuredUnit || '').trim();

  if (!unit) {
    return formattedNum;
  }
  return `${formattedNum} ${unit}`;
}

export function formatRawMaterialUsage(
  usage: number | string | null | undefined,
  unitOrCategory?: string | null,
  legacyUnit?: string | null
): string {
  const isCategory = isCategoryName(unitOrCategory || '');
  const resolvedUnit = isCategory ? (legacyUnit || '') : (unitOrCategory || legacyUnit || '');
  return formatRawMaterialQuantity(usage, resolvedUnit);
}

export function formatRawMaterialWastage(
  wastage: number | string | null | undefined,
  unitOrCategory?: string | null,
  legacyUnit?: string | null
): string {
  const isCategory = isCategoryName(unitOrCategory || '');
  const resolvedUnit = isCategory ? (legacyUnit || '') : (unitOrCategory || legacyUnit || '');
  return formatRawMaterialQuantity(wastage, resolvedUnit);
}

export function formatWeightValue(val: number, unit = 'KG'): string {
  return `${val} ${unit}`;
}

function isCategoryName(str: string): boolean {
  const s = str.trim().toUpperCase();
  return (
    s === 'PREFORM' ||
    s === 'BOTTLE' ||
    s === 'CAP' ||
    s === 'LABEL' ||
    s === 'SHRINK' ||
    s === 'GLUE' ||
    s === 'INK' ||
    s === 'MAKEUP' ||
    s === 'CHEMICAL'
  );
}

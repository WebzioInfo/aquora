/**
 * Centralized Raw Material Usage & Wastage Formatting Utility for Aquora ERP
 */

export function formatWeightValue(val: number): string {
  if (val >= 1) {
    return `${val} KG`;
  }
  const gm = Math.round(val * 1000);
  return `${gm} GM`;
}

export function formatRawMaterialUsage(usage: number | string, categoryOrType?: string, defaultUnit?: string): string {
  const val = typeof usage === 'string' ? parseFloat(usage) || 0 : usage || 0;
  const cat = (categoryOrType || '').toUpperCase();

  if (cat.includes('PREFORM')) {
    return val === 1 ? `${val} Bag` : `${val} Bags`;
  }
  if (cat.includes('CAP')) {
    return `${val} BOX`;
  }
  if (cat.includes('LABEL') || cat.includes('SHRINK')) {
    return formatWeightValue(val);
  }

  return `${val} ${defaultUnit || ''}`.trim();
}

export function formatRawMaterialWastage(wastage: number | string, categoryOrType?: string, defaultUnit?: string): string {
  const val = typeof wastage === 'string' ? parseFloat(wastage) || 0 : wastage || 0;
  const cat = (categoryOrType || '').toUpperCase();

  if (cat.includes('PREFORM')) {
    return `${val} PCS`;
  }
  if (cat.includes('CAP')) {
    return `${val} PCS`;
  }
  if (cat.includes('LABEL') || cat.includes('SHRINK')) {
    return formatWeightValue(val);
  }
  if (cat.includes('GLUE') || cat.includes('INK') || cat.includes('MAKEUP')) {
    return `${val} ${defaultUnit || 'KG'}`.trim();
  }

  return `${val} ${defaultUnit || 'PCS'}`.trim();
}

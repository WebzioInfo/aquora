/**
 * Centralized Raw Material Categories Definition
 * Used across Admin Inventory, Operator dashboards, and forms.
 */
export const RAW_MATERIAL_CATEGORIES = {
  PREFORM: { value: 'PREFORM', label: 'PREFORM' },
  CAP: { value: 'CAP', label: 'CAP' },
  LABEL: { value: 'LABEL', label: 'LABEL' },
  SHRINK_FILM: { value: 'SHRINK_FILM', label: 'SHRINK FILM' },
  CARTON: { value: 'CARTON', label: 'CARTON' },
  HANDLE: { value: 'HANDLE', label: 'HANDLE' },
  ADHESIVE: { value: 'ADHESIVE', label: 'ADHESIVE' },
  GLUE: { value: 'GLUE', label: 'GLUE (ADHESIVE)' },
  INK: { value: 'INK', label: 'INK' },
  MAKEUP: { value: 'MAKEUP', label: 'MAKEUP' },
  CHEMICAL: { value: 'CHEMICAL', label: 'CHEMICAL' },
  OTHER: { value: 'OTHER', label: 'OTHER' }
} as const;

export type RawMaterialCategoryKey = keyof typeof RAW_MATERIAL_CATEGORIES;

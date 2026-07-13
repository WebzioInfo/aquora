# Aquora ERP Design System Style Guide
*Enterprise White & Blue design language for manufacturing and production operations.*

---

## 1. Color Palette

### Light Mode (Primary)
* **Page Background**: `#F7F9FC` (very light gray-blue)
* **Card/Surface Background**: `#FFFFFF` (pure white)
* **Primary Brand Blue**: `#1A56DB` (used for active states, links, main buttons, and key icons)
* **Selected Row / Hover Blue**: `#E8F0FE` (subtle selected blue fill)
* **Border & Dividers**: `#E2E8F0` (light border gray)
* **Primary Text**: `#111827` (slate-900 near black)
* **Secondary Text**: `#6B7280` (gray-500)
* **Disabled Text/Borders**: `#9CA3AF` (gray-400)

### Dark Mode (Alternative)
* **Page Background**: `#0F172A` (slate-900 dark)
* **Card/Surface Background**: `#1E293B` (slate-800 card fill)
* **Primary Accent Blue**: `#1A56DB` (enterprise blue)
* **Border & Dividers**: `#334155` (slate-700)
* **Primary Text**: `#F9FAFB` (gray-50 text)
* **Secondary Text**: `#9CA3AF` (gray-400 text)

### Status Badges (10–15% opacity backgrounds with matching text)
* **Success Green**: Background: `#DCFCE7` (10%), Text: `#16A34A`
* **Warning Amber**: Background: `#FEF3C7` (10%), Text: `#D97706`
* **Error Red**: Background: `#FEE2E2` (10%), Text: `#DC2626`
* **Info Blue**: Background: `#DBEAFE` (10%), Text: `#2563EB`

---

## 2. Typography

* **Font Family**: `Inter, system-ui, -apple-system, sans-serif`
* **Font Weights**:
  * Body: `400`
  * Buttons / Form Labels: `500`
  * Subheadings / Card Titles: `600`
  * Headings / Page Titles: `700`
* **Type Scale**:
  * **Page Title**: `24px` / Weight `700`
  * **Section Heading**: `18px` / Weight `600`
  * **Card Title / Table Header**: `14px` / Weight `600`
  * **Body Text**: `14px` / Weight `400`
  * **Small / Meta Text**: `12px` / Weight `400`
* **Line Height**: `1.5` for body text, `1.3` for headings.
* **No Italic text**. No underlines except for text hyperlinks.

---

## 3. Spacing & Layout Grid

* **Base spacing unit**: `4px`.
* **Standard padding and margins**: Multiples of 4 (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
* **Page Padding**: `24px` (desktop), `16px` (tablet/mobile).
* **Card Padding**: `16px` to `20px` internal padding.
* **Layout Gaps**:
  * Gap between cards / dashboard widgets: `24px`.
  * Gap between form fields: `16px` (vertical & horizontal).
* **Layout Grid**: 12-column responsive layout. Sidebar width: `240px`. Fluid content body.
* **Max Width**: `1440px` centered.

---

## 4. Component Rules

* **Buttons**:
  * **Dimensions**: Height `40px` (standard), `36px` (small). Border radius: `8px`.
  * **Primary**: Background: `#1A56DB` (brand blue), Text: `#FFFFFF`, hover state: `#1E40AF` (darker blue).
  * **Secondary**: White background, Border: `1px solid #1A56DB`, Text: `#1A56DB`, hover state: background `#E8F0FE`.
  * **Disabled**: Gray background, Gray text, no shadows.
* **Inputs & Selects**:
  * **Dimensions**: Height `40px`. Border radius: `8px`. Border: `1px solid #E2E8F0`.
  * **Padding**: `8px 12px`.
  * **Focus State**: Border color: `#1A56DB`, with a subtle blue ring glow (`box-shadow`).
* **Cards & Panels**:
  * White background (`#FFFFFF`), Border radius: `12px`.
  * Shadow: Subtle elevation `0 1px 3px rgba(0,0,0,0.06)`. Border: `1px solid #E2E8F0`.
* **Tables**:
  * Header row background: `#F4F6F9` (light gray-blue).
  * Header text: `14px` / Weight `600`.
  * Row height: `48px`. Zebra striping: very subtle.
  * Selected / Hover row: `#E8F0FE` background. Sticky headers for long datasets.
* **Sidebar**:
  * White or very light background.
  * Active item: Blue text + Light blue background pill + Left blue vertical indicator border line.
* **Badges/Status Pills**:
  * Shape: `rounded-full` (capsule).
  * Text size: `12px`.
* **Icons**:
  * Consistent set (Lucide/Heroicons), stroke-based, size `18px` to `20px`, tone: blue or gray. No drop shadows.
* **Modals**:
  * Max width: `480px` to `640px`.
  * Layout: Header + Body + Footer. Footer buttons are right-aligned: Cancel (left), Confirm (right, brand blue).

---

## 5. Alignment & Consistency Rules
* All form labels must align to the left above the input element with a `4px` gap, weight `500` (12px), text color `#374151` (gray-700).
* Page headers: Page Title (left) + Action Buttons (right), optional breadcrumbs nested above.
* Table column padding and row alignments must remain uniform across all modules.

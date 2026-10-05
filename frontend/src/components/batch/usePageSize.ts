import { useState, useEffect, type RefObject } from 'react'

export interface UsePageSizeOptions {
  itemHeight: number
  gap: number
  isSingleColumn?: boolean
}

export interface UsePageSizeResult {
  columns: number
  rows: number
  pageSize: number
}

export function usePageSize(
  ref: RefObject<HTMLElement | null>,
  options: UsePageSizeOptions
): UsePageSizeResult {
  const { itemHeight, gap, isSingleColumn = false } = options

  const [state, setState] = useState<UsePageSizeResult>(() => {
    const initialCols = isSingleColumn
      ? 1
      : typeof window !== 'undefined' && window.innerWidth >= 1280
      ? 4
      : typeof window !== 'undefined' && window.innerWidth >= 640
      ? 2
      : 1
    return {
      columns: initialCols,
      rows: 4,
      pageSize: initialCols * 4
    }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const updateSize = () => {
      const { clientWidth: width, clientHeight: height } = el
      if (width === 0 || height === 0) return

      // Determine columns
      let cols = 1
      if (!isSingleColumn) {
        if (width >= 1280) {
          cols = 4
        } else if (width >= 600) {
          cols = 2
        } else {
          cols = 1
        }
      }

      // Page size = floor(availableHeight / (itemHeight + gap)) x columns
      const rows = Math.max(1, Math.floor((height + gap) / (itemHeight + gap)))
      const pageSize = Math.max(1, cols * rows)

      setState((prev) => {
        if (prev.columns === cols && prev.rows === rows && prev.pageSize === pageSize) {
          return prev
        }
        return { columns: cols, rows, pageSize }
      })
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [ref, itemHeight, gap, isSingleColumn])

  return state
}

export default usePageSize

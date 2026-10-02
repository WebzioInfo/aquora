import { useState, useEffect } from 'react'

export interface ViewportSize {
  width: number
  height: number
  isShortScreen: boolean       // height <= 820px: compact KPI/breakdown cards
  isCollapseBreakdown: boolean // height <= 720px: breakdown cards collapsible
  isScrollKpi: boolean         // height <= 600px: KPI cards in horizontal scroll strip
  isMobile: boolean            // width < 640px: mobile card view
}

export const useViewportSize = (): ViewportSize => {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 900
  })

  useEffect(() => {
    let timeoutId: any = null
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }, 50)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return {
    width: size.width,
    height: size.height,
    isShortScreen: size.height <= 820,
    isCollapseBreakdown: size.height <= 720,
    isScrollKpi: size.height <= 600 || size.width < 640,
    isMobile: size.width < 640
  }
}

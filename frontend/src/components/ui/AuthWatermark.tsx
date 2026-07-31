import React from 'react'
import BRAND from '../../config/brand'

interface AuthWatermarkProps {
  className?: string
}

export const AuthWatermark: React.FC<AuthWatermarkProps> = ({ className = '' }) => {
  // Generate 35 staggered pattern tiles (7 cols x 5 rows) covering 100vw x 100vh
  const totalTiles = 35

  const rotations = [-20, -18, -22, -19, -21, -17, -23]
  const opacities = [0.032, 0.028, 0.035, 0.03, 0.026, 0.034, 0.029]

  return (
    <div 
      className={`fixed inset-0 overflow-hidden pointer-events-none select-none z-0 ${className}`}
      aria-hidden="true"
    >
      <div className="w-[120vw] h-[120vh] -ml-[10vw] -mt-[10vh] grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-6 sm:gap-10 md:gap-14 items-center justify-items-center">
        {Array.from({ length: totalTiles }).map((_, idx) => {
          const col = idx % 7
          const row = Math.floor(idx / 7)
          const rot = rotations[(row + col) % rotations.length]
          const op = opacities[(row * 3 + col) % opacities.length]
          const isStaggered = row % 2 === 1

          return (
            <div 
              key={idx}
              className={`transform flex items-center justify-center transition-opacity duration-300 ${
                isStaggered ? 'translate-x-6 sm:translate-x-12 md:translate-x-16' : ''
              }`}
              style={{
                transform: `rotate(${rot}deg)`,
                opacity: op
              }}
            >
              <img
                src={BRAND.watermarkLogo}
                alt=""
                className="w-24 sm:w-32 md:w-40 lg:w-44 h-auto object-contain filter grayscale blur-[0.3px]"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const AuthBackgroundWatermark = AuthWatermark
export default AuthWatermark

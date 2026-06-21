/**
 * Shimmer skeleton loader.
 * Usage: <Skeleton width={120} height={16} />  or  <Skeleton style={{...}} />
 */
import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 14, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  )
}

/** Stack of skeleton lines — useful for text placeholders */
export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={12} />
      ))}
    </div>
  )
}

/** Full card placeholder */
export function SkeletonCard({ height = 200 }: { height?: number }) {
  return (
    <div style={{
      background: '#111', borderRadius: 16, padding: 20, height,
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={140} height={18} />
        <Skeleton width={40} height={18} borderRadius={999} />
      </div>
      <Skeleton width="100%" height={8} borderRadius={4} />
      <SkeletonText lines={3} />
      <div style={{ marginTop: 'auto' }}>
        <Skeleton width={80} height={12} />
      </div>
    </div>
  )
}

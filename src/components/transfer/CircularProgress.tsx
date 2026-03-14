import { motion } from 'framer-motion'

interface CircularProgressProps {
  /** 进度百分比 (0-100) */
  percentage: number
  /** SVG 尺寸 */
  size?: number
  /** 线条宽度 */
  strokeWidth?: number
  /** 轨道颜色 */
  trackColor?: string
  /** 进度颜色 */
  progressColor?: string
}

/**
 * 环形进度条组件
 * 从顶部（12点方向）开始绘制，支持动画过渡
 */
export function CircularProgress({
  percentage,
  size = 36,
  strokeWidth = 3,
  trackColor = 'currentColor',
  progressColor = 'currentColor',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  // 从顶部开始，需要偏移 -90 度
  const offset = circumference - (percentage / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* 背景轨道 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      {/* 进度条 */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </svg>
  )
}

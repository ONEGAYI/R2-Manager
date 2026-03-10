import { motion } from 'framer-motion'

export function Loading() {
  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

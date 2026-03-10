import { Inbox } from 'lucide-react'
import { motion } from 'framer-motion'

interface EmptyProps {
  message?: string
  description?: string
}

export function Empty({ message = '暂无数据', description }: EmptyProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-12 text-muted-foreground"
    >
      <Inbox className="h-16 w-16 mb-4 opacity-50" />
      <p className="text-lg font-medium">{message}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
    </motion.div>
  )
}

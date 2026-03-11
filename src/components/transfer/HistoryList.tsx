import { AnimatePresence } from 'framer-motion'
import { HistoryItem } from './HistoryItem'
import type { TransferHistory } from '@/types/transfer'

interface HistoryListProps {
  histories: TransferHistory[]
  onRemove: (id: string) => void
  emptyMessage?: string
}

export function HistoryList({
  histories,
  onRemove,
  emptyMessage = '暂无记录'
}: HistoryListProps) {
  if (histories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <span className="text-4xl mb-4">✅</span>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {histories.map((history) => (
          <HistoryItem
            key={history.id}
            history={history}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

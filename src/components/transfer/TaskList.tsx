import { AnimatePresence } from 'framer-motion'
import { TaskItem } from './TaskItem'
import type { TransferTask } from '@/types/transfer'

interface TaskListProps {
  tasks: TransferTask[]
  onCancel: (id: string) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  emptyMessage?: string
}

export function TaskList({
  tasks,
  onCancel,
  onPause,
  onResume,
  emptyMessage = '暂无任务'
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <span className="text-4xl mb-4">📭</span>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onCancel={onCancel}
            onPause={onPause}
            onResume={onResume}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

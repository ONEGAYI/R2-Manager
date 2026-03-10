import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface MainLayoutProps {
  children: ReactNode
  buckets: string[]
  selectedBucket: string | null
  onSelectBucket: (name: string) => void
  onOpenSettings?: () => void
  onCreateBucket?: () => void
  onDeleteBucket?: (name: string) => Promise<boolean>
}

export function MainLayout({
  children,
  buckets,
  selectedBucket,
  onSelectBucket,
  onOpenSettings,
  onCreateBucket,
  onDeleteBucket,
}: MainLayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        buckets={buckets}
        selectedBucket={selectedBucket}
        onSelectBucket={onSelectBucket}
        onOpenSettings={onOpenSettings}
        onCreateBucket={onCreateBucket}
        onDeleteBucket={onDeleteBucket}
      />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}

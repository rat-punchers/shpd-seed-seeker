import type { Icon } from '@phosphor-icons/react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@seed-seeker/design/ui/empty'
import type { ReactNode } from 'react'

/** The main area of a workspace with nothing in it yet, and what it offers. */
export function WorkspaceEmptyPlaceholder({
  icon: IconComponent,
  title,
  description,
  children,
}: {
  icon: Icon
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconComponent />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

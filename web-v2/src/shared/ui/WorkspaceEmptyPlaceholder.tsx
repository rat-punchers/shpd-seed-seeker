import type { Icon } from '@phosphor-icons/react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@seed-seeker/design/ui/empty'

/** The main area of a workspace with nothing in it yet. */
export function WorkspaceEmptyPlaceholder({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon
  title: string
  description: string
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
    </Empty>
  )
}

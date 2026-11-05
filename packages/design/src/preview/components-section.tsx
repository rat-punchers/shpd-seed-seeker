import { ControlsSpecimen } from './controls-specimen'
import { FeedbackSpecimen } from './feedback-specimen'
import { OverlaysSpecimen } from './overlays-specimen'
import { Section } from './section'

export function ComponentsSection() {
  return (
    <Section
      id="components"
      intro="shadcn/ui on the radix-lyra style, restyled through the tokens: 14px controls, 2px corners, bevels for state. The web app imports these same components from @seed-seeker/design."
    >
      <ControlsSpecimen />
      <FeedbackSpecimen />
      <OverlaysSpecimen />
    </Section>
  )
}

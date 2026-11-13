import { WarningCircleIcon } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { Button } from '@seed-seeker/design/ui/button'
import { Component, type ReactNode } from 'react'
import { clearRequirements } from './store'

/**
 * Keeps a failure of the requirement editor inside the Advanced view. The
 * query is saved, so requirements the editor cannot draw would come back on
 * every reload; the fallback says what failed and offers the way out.
 */
export class AdvancedBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  private clear = () => {
    clearRequirements()
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Alert variant="destructive">
        <WarningCircleIcon />
        <AlertTitle>The requirements could not be shown</AlertTitle>
        <AlertDescription>
          <p>The requirements could not be shown: {error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={this.clear}
          >
            Clear requirements
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
}

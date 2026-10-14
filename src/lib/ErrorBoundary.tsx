import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type ErrorBoundaryProps = {
  // Names the part that failed in the console warning.
  label: string
  fallback: ReactNode
  onError?: () => void
  children: ReactNode
}

type ErrorBoundaryState = { failed: boolean }

// Keeps a failure local (ADR 006, degradation): the part that failed is
// replaced by its fallback and the rest of the page stays. Remount it with a
// new `key` to retry.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`${this.props.label} failed; showing its fallback.`, error, info.componentStack)
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

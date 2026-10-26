import { Component, type ReactNode } from 'react'
/** Optional UI failures must never unmount the surrounding workspace or discard drafts. */
export class PluginBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure?: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure?.() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

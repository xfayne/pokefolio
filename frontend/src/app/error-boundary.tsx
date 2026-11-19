import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import i18n from '@/lib/i18n';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="space-y-4 p-6"><p role="alert">{i18n.t('failed')}</p><Button onClick={() => window.location.reload()}>{i18n.t('reload')}</Button></main> : this.props.children;
  }
}

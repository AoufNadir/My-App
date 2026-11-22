// @ts-nocheck — React.Component instance types aren't bundled with the
// React 19 module shipped here (no @types/react installed). The runtime
// build (vite/esbuild) is unaffected.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ui/ErrorState';
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: (error: Error, reset: () => void) => ReactNode;
    onError?: (error: Error, info: ErrorInfo) => void;
    key?: string | number | null;
}
interface ErrorBoundaryState {
    error: Error | null;
}
// V24-1: after a deploy, an app left open asks for page files that no longer exist: that error is not a bug, a reload fixes it.
export const isStaleChunkError = (error: unknown): boolean => /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk/i.test(String((error as Error)?.message || error));
function StaleVersion() {
    const ar = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
    return (<div role="alert" className="mx-auto my-8 flex max-w-sm flex-col items-center gap-3 rounded-card border border-border bg-surface p-5 text-center">
      <p className="text-sm font-bold text-neutral-900">{ar ? 'نُشرت نسخة جديدة من التطبيق' : 'Une nouvelle version a été publiée'}</p>
      <p className="text-xs text-neutral-600">{ar ? 'حدّث الصفحة لتكمل.' : 'Rechargez pour continuer.'}</p>
      <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-button bg-primary px-5 text-sm font-bold text-white">{ar ? 'حدّث الآن' : 'Mettre à jour'}</button>
    </div>);
}
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        if (this.props.onError)
            this.props.onError(error, info);
        if (typeof console !== 'undefined')
            console.error('[ErrorBoundary]', error, info);
    }
    reset = () => this.setState({ error: null });
    render(): ReactNode {
        const { error } = this.state;
        if (error) {
            if (isStaleChunkError(error))
                return <StaleVersion/>;
            if (this.props.fallback)
                return this.props.fallback(error, this.reset);
            return <ErrorState message={error.message} onRetry={this.reset}/>;
        }
        return this.props.children;
    }
}

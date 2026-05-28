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
            if (this.props.fallback)
                return this.props.fallback(error, this.reset);
            return <ErrorState message={error.message} onRetry={this.reset}/>;
        }
        return this.props.children;
    }
}

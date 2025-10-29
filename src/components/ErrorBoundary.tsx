// src/components/ErrorBoundary.tsx
import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };


    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {

        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div style={{ padding: 20, background: '#fee', color: '#c00', borderRadius: 8 }}>
                        <h2>Something Wrong！</h2>
                        <details style={{ whiteSpace: 'pre-wrap' }}>
                            <summary>Click for details</summary>
                            <pre>{this.state.error?.message}</pre>
                            <pre>{this.state.error?.stack}</pre>
                        </details>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          backgroundColor: 'var(--color-bg)'
        }}>
          <div className="card" style={{
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={48} color="var(--color-error)" />
            </div>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--color-text)'
            }}>
              Something went wrong
            </h2>

            <p style={{
              color: 'var(--color-text-secondary)',
              marginBottom: '24px',
              lineHeight: 1.6
            }}>
              We're sorry for the inconvenience. An unexpected error occurred while
              rendering this component. Please try refreshing the page or resetting
              the component.
            </p>

            {this.state.error && (
              <details style={{
                marginBottom: '24px',
                textAlign: 'left',
                backgroundColor: 'var(--color-bg)',
                padding: '12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: 'var(--color-text)'
                }}>
                  Error Details
                </summary>
                <div style={{
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--color-error)'
                }}>
                  <strong>Error:</strong> {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        {this.state.errorInfo.componentStack}
                      </div>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              <button
                className="btn btn-secondary"
                onClick={this.handleReset}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                className="btn btn-primary"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 * Note: This requires React 18+ with error boundaries support
 */
interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div style={{
      padding: '24px',
      backgroundColor: 'var(--color-bg)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--color-border)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <AlertTriangle size={20} color="var(--color-error)" />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Error
        </h3>
      </div>
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: '0.875rem',
        marginBottom: '12px'
      }}>
        {error.message}
      </p>
      <button className="btn btn-secondary btn-sm" onClick={resetError}>
        <RefreshCw size={14} />
        Try Again
      </button>
    </div>
  );
}

/**
 * Lightweight error boundary for specific sections
 */
interface InlineErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

export class InlineErrorBoundary extends Component<InlineErrorBoundaryProps, State> {
  constructor(props: InlineErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('InlineErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

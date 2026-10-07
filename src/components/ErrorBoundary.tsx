import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackScreen?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 shadow-lg shadow-rose-950/30">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Screen Failed to Load</h2>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            An unexpected error occurred while rendering this view. Your session and saved data are intact.
          </p>

          {this.state.error && (
            <div className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-6 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-32">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
              <span>Retry Screen</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Return Home</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

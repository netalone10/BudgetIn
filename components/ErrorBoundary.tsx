"use client";

/**
 * Tujuan: React Error Boundary — tangkap crash di subtree, tampilkan fallback UI
 * Caller: app/dashboard/layout.tsx
 * Dependensi: -
 * Main Functions: ErrorBoundary
 * Side Effects: -
 */

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Terjadi kesalahan</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{this.state.message}</p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.reload();
            }}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

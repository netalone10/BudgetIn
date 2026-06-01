export interface PerformanceThreshold {
  metricName: string;
  thresholdMs: number;
}

export interface ThresholdBreachWarning {
  metricName: string;
  measuredMs: number;
  thresholdMs: number;
  message: string;
}

export const THRESHOLDS: Record<string, number> = {
  "dashboard-tti": 3000,
  "transaction-create": 2000,
  "pdf-generation": 10000,
  "sheets-sync": 5000,
};

/**
 * Core Web Vitals thresholds based on Google's recommended targets (75th percentile).
 * - LCP: Largest Contentful Paint — target < 2500ms
 * - INP: Interaction to Next Paint — target < 200ms
 * - CLS: Cumulative Layout Shift — target < 0.1
 */
export const WEB_VITALS_THRESHOLDS: Record<string, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
};

export interface WebVitalsMetric {
  name: string;
  value: number;
  id: string;
  rating?: "good" | "needs-improvement" | "poor";
}

/**
 * Reports a Core Web Vitals metric by checking it against defined thresholds.
 * Logs a warning to the console when a metric exceeds its threshold.
 * This function is designed to be called from a client component that
 * subscribes to web-vitals events.
 *
 * Note: @vercel/analytics automatically reports CWV to Vercel's dashboard.
 * This function provides additional local threshold monitoring and logging.
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  const threshold = WEB_VITALS_THRESHOLDS[metric.name];

  if (threshold !== undefined && metric.value > threshold) {
    console.warn(
      `[Core Web Vitals] ${metric.name} exceeded threshold: ${metric.value}${metric.name === "CLS" ? "" : "ms"} (threshold: ${threshold}${metric.name === "CLS" ? "" : "ms"})`
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[Core Web Vitals] ${metric.name}: ${metric.value}${metric.name === "CLS" ? "" : "ms"} [${metric.rating ?? "unknown"}]`
    );
  }
}

/**
 * Checks whether a measured duration exceeds the defined threshold for a given metric.
 * Returns a ThresholdBreachWarning if the threshold is exceeded, or null otherwise.
 */
export function checkThresholdBreach(
  metricName: string,
  measuredMs: number
): ThresholdBreachWarning | null {
  if (!Object.prototype.hasOwnProperty.call(THRESHOLDS, metricName)) return null;
  const threshold = THRESHOLDS[metricName];
  if (measuredMs <= threshold) return null;

  return {
    metricName,
    measuredMs,
    thresholdMs: threshold,
    message: `Performance warning: ${metricName} took ${measuredMs}ms (threshold: ${threshold}ms)`,
  };
}

/**
 * Client-side performance measurement using the Performance API.
 * Returns a stop function that, when called, returns the elapsed duration in milliseconds.
 * If the Performance API is unavailable, returns a no-op that always returns 0.
 */
export function measureTiming(markName: string): () => number {
  if (typeof performance === "undefined") return () => 0;
  performance.mark(`${markName}-start`);
  return () => {
    performance.mark(`${markName}-end`);
    const measure = performance.measure(
      markName,
      `${markName}-start`,
      `${markName}-end`
    );
    return measure.duration;
  };
}

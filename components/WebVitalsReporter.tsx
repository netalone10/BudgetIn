"use client";

import { useEffect } from "react";
import { reportWebVitals, type WebVitalsMetric } from "@/lib/performance";

/**
 * Client component that subscribes to Core Web Vitals metrics
 * and reports them through our custom threshold monitoring.
 *
 * @vercel/speed-insights already reports CWV to Vercel's dashboard.
 * This component adds local threshold monitoring and console warnings
 * when metrics exceed targets:
 * - LCP < 2500ms
 * - INP < 200ms
 * - CLS < 0.1
 */
export function WebVitalsReporter() {
  useEffect(() => {
    import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
      const handleMetric = (metric: { name: string; value: number; id: string; rating: string }) => {
        reportWebVitals({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          rating: metric.rating as WebVitalsMetric["rating"],
        });
      };

      onLCP(handleMetric);
      onINP(handleMetric);
      onCLS(handleMetric);
    });
  }, []);

  return null;
}

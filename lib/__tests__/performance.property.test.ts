import fc from "fast-check";
import { checkThresholdBreach, THRESHOLDS } from "@/lib/performance";

/**
 * Property 6: Performance Threshold Breach Detection
 *
 * For any metric name with a defined threshold and any measured duration,
 * `checkThresholdBreach` SHALL return `null` when the measured duration is
 * less than or equal to the threshold, and SHALL return a `ThresholdBreachWarning`
 * containing the metric name, measured duration, and threshold value when the
 * measured duration exceeds the threshold.
 *
 * **Validates: Requirements 11.5, 12.5**
 */

const definedMetricNames = Object.keys(THRESHOLDS);

const metricNameArb: fc.Arbitrary<string> = fc.constantFrom(...definedMetricNames);

const durationArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 100000,
  noNaN: true,
  noDefaultInfinity: true,
});

describe("Property 6: Performance Threshold Breach Detection", () => {
  it("returns null when measured duration is less than or equal to the threshold", () => {
    fc.assert(
      fc.property(metricNameArb, (metricName) => {
        const threshold = THRESHOLDS[metricName];
        // Generate a duration that is at most the threshold
        fc.assert(
          fc.property(
            fc.double({ min: 0, max: threshold, noNaN: true, noDefaultInfinity: true }),
            (measuredMs) => {
              const result = checkThresholdBreach(metricName, measuredMs);
              expect(result).toBeNull();
            }
          ),
          { numRuns: 50 }
        );
      }),
      { numRuns: 20 }
    );
  });

  it("returns a ThresholdBreachWarning when measured duration exceeds the threshold", () => {
    fc.assert(
      fc.property(metricNameArb, (metricName) => {
        const threshold = THRESHOLDS[metricName];
        // Generate a duration strictly greater than the threshold
        fc.assert(
          fc.property(
            fc.double({
              min: threshold + 0.001,
              max: threshold * 10,
              noNaN: true,
              noDefaultInfinity: true,
            }),
            (measuredMs) => {
              const result = checkThresholdBreach(metricName, measuredMs);
              expect(result).not.toBeNull();
              expect(result!.metricName).toBe(metricName);
              expect(result!.measuredMs).toBe(measuredMs);
              expect(result!.thresholdMs).toBe(threshold);
            }
          ),
          { numRuns: 50 }
        );
      }),
      { numRuns: 20 }
    );
  });

  it("warning message contains the metric name, measured duration, and threshold", () => {
    fc.assert(
      fc.property(metricNameArb, durationArb, (metricName, measuredMs) => {
        const threshold = THRESHOLDS[metricName];
        const result = checkThresholdBreach(metricName, measuredMs);

        if (measuredMs > threshold) {
          expect(result).not.toBeNull();
          expect(result!.message).toContain(metricName);
          expect(result!.message).toContain(String(measuredMs));
          expect(result!.message).toContain(String(threshold));
        }
      }),
      { numRuns: 200 }
    );
  });

  it("returns null for any metric name not in the defined thresholds", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) => !definedMetricNames.includes(s)
        ),
        durationArb,
        (unknownMetric, measuredMs) => {
          const result = checkThresholdBreach(unknownMetric, measuredMs);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("at the exact threshold boundary, returns null (duration equals threshold)", () => {
    fc.assert(
      fc.property(metricNameArb, (metricName) => {
        const threshold = THRESHOLDS[metricName];
        const result = checkThresholdBreach(metricName, threshold);
        expect(result).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});

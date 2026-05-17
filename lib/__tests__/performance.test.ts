import {
  checkThresholdBreach,
  measureTiming,
  reportWebVitals,
  THRESHOLDS,
  WEB_VITALS_THRESHOLDS,
} from "@/lib/performance";

describe("checkThresholdBreach", () => {
  it("returns null when measured duration is within threshold", () => {
    const result = checkThresholdBreach("dashboard-tti", 2500);
    expect(result).toBeNull();
  });

  it("returns null when measured duration equals threshold exactly", () => {
    const result = checkThresholdBreach("dashboard-tti", 3000);
    expect(result).toBeNull();
  });

  it("returns a warning when measured duration exceeds threshold", () => {
    const result = checkThresholdBreach("dashboard-tti", 3500);
    expect(result).toEqual({
      metricName: "dashboard-tti",
      measuredMs: 3500,
      thresholdMs: 3000,
      message:
        "Performance warning: dashboard-tti took 3500ms (threshold: 3000ms)",
    });
  });

  it("returns null for an unknown metric name", () => {
    const result = checkThresholdBreach("unknown-metric", 99999);
    expect(result).toBeNull();
  });

  it("detects breach for transaction-create threshold", () => {
    const result = checkThresholdBreach("transaction-create", 2500);
    expect(result).not.toBeNull();
    expect(result!.thresholdMs).toBe(2000);
  });

  it("detects breach for pdf-generation threshold", () => {
    const result = checkThresholdBreach("pdf-generation", 12000);
    expect(result).not.toBeNull();
    expect(result!.thresholdMs).toBe(10000);
  });

  it("detects breach for sheets-sync threshold", () => {
    const result = checkThresholdBreach("sheets-sync", 6000);
    expect(result).not.toBeNull();
    expect(result!.thresholdMs).toBe(5000);
  });
});

describe("measureTiming", () => {
  it("returns a function that measures elapsed time", () => {
    const stop = measureTiming("test-operation");
    // The stop function should return a number (duration)
    const duration = stop();
    expect(typeof duration).toBe("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("uses performance marks with the correct naming convention", () => {
    const markSpy = jest.spyOn(performance, "mark");
    const measureSpy = jest.spyOn(performance, "measure");

    const stop = measureTiming("my-metric");
    expect(markSpy).toHaveBeenCalledWith("my-metric-start");

    stop();
    expect(markSpy).toHaveBeenCalledWith("my-metric-end");
    expect(measureSpy).toHaveBeenCalledWith(
      "my-metric",
      "my-metric-start",
      "my-metric-end"
    );

    markSpy.mockRestore();
    measureSpy.mockRestore();
  });
});

describe("THRESHOLDS", () => {
  it("defines dashboard-tti at 3000ms", () => {
    expect(THRESHOLDS["dashboard-tti"]).toBe(3000);
  });

  it("defines transaction-create at 2000ms", () => {
    expect(THRESHOLDS["transaction-create"]).toBe(2000);
  });

  it("defines pdf-generation at 10000ms", () => {
    expect(THRESHOLDS["pdf-generation"]).toBe(10000);
  });

  it("defines sheets-sync at 5000ms", () => {
    expect(THRESHOLDS["sheets-sync"]).toBe(5000);
  });
});

describe("reportWebVitals", () => {
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it("logs a warning when LCP exceeds 2500ms threshold", () => {
    reportWebVitals({ name: "LCP", value: 3000, id: "v1-123" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("LCP exceeded threshold: 3000ms")
    );
  });

  it("logs a warning when INP exceeds 200ms threshold", () => {
    reportWebVitals({ name: "INP", value: 350, id: "v1-456" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("INP exceeded threshold: 350ms")
    );
  });

  it("logs a warning when CLS exceeds 0.1 threshold", () => {
    reportWebVitals({ name: "CLS", value: 0.25, id: "v1-789" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("CLS exceeded threshold: 0.25")
    );
  });

  it("does not log a warning when LCP is within threshold", () => {
    reportWebVitals({ name: "LCP", value: 2000, id: "v1-100" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log a warning when INP is within threshold", () => {
    reportWebVitals({ name: "INP", value: 150, id: "v1-101" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log a warning when CLS is within threshold", () => {
    reportWebVitals({ name: "CLS", value: 0.05, id: "v1-102" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn for metrics at exactly the threshold value", () => {
    reportWebVitals({ name: "LCP", value: 2500, id: "v1-200" });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("WEB_VITALS_THRESHOLDS", () => {
  it("defines LCP threshold at 2500ms", () => {
    expect(WEB_VITALS_THRESHOLDS["LCP"]).toBe(2500);
  });

  it("defines INP threshold at 200ms", () => {
    expect(WEB_VITALS_THRESHOLDS["INP"]).toBe(200);
  });

  it("defines CLS threshold at 0.1", () => {
    expect(WEB_VITALS_THRESHOLDS["CLS"]).toBe(0.1);
  });
});

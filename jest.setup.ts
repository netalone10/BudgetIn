/**
 * Test setup — runs in the test environment before each test file.
 *
 * jsdom (used by React component tests) does not expose `fetch` and other
 * Web APIs on its global. Pull them from the Node host (Node 18+ ships
 * `fetch` natively) and assign them onto the jsdom sandbox global. We also
 * wrap `fetch` so that relative URLs (e.g. `/api/record`) resolve against
 * the jsdom `window.location`, matching real-browser behavior.
 *
 * Critically, we override `AbortController`/`AbortSignal` with the host
 * versions too — Node's native `fetch` rejects with `TypeError: Expected
 * signal ... to be an instance of AbortSignal` if it receives a jsdom
 * `AbortSignal` instance. Using the host versions everywhere keeps the
 * `instanceof` check happy.
 */
const g = globalThis as unknown as Record<string, unknown>;

// Walk back from the `process` object's constructor chain to reach the Node
// host's `globalThis` (which IS where `fetch` lives in Node 18+).
 
const hostGlobal: any =
  typeof process !== "undefined" &&
   
  (process as any).constructor &&
   
  (process as any).constructor.constructor("return globalThis")();

if (hostGlobal && typeof hostGlobal.fetch === "function") {
  // Forward Web APIs that the test environment lacks. Always overwrite
  // `AbortController`/`AbortSignal` with the host versions so signals
  // passed through to the host `fetch` pass `instanceof AbortSignal`.
  g.fetch = hostGlobal.fetch;
  if (g.Headers === undefined) g.Headers = hostGlobal.Headers;
  if (g.Request === undefined) g.Request = hostGlobal.Request;
  if (g.Response === undefined) g.Response = hostGlobal.Response;
  if (g.FormData === undefined) g.FormData = hostGlobal.FormData;
  // Force-replace these — jsdom ships its own AbortController/AbortSignal,
  // but they are not interchangeable with the host versions used by the
  // host `fetch` implementation.
  if (hostGlobal.AbortController) g.AbortController = hostGlobal.AbortController;
  if (hostGlobal.AbortSignal) g.AbortSignal = hostGlobal.AbortSignal;
}

// `BroadcastChannel` is not part of jsdom; provide a noop stub so direct
// module imports don't crash the environment.
if (g.BroadcastChannel === undefined) {
  g.BroadcastChannel = class {
    constructor(_name: string) {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

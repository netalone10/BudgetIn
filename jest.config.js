/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  // Provide a real-looking URL so jsdom's `window.location` is set and
  // `fetch("/api/...")` resolves to a parseable absolute URL when used in
  // tests that opt into the jsdom environment via the per-file pragma.
  testEnvironmentOptions: {
    url: "http://localhost/",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // server-only adalah package Next.js yang hanya berjalan di server.
    // Di Jest (Node environment) tidak tersedia — mock sebagai no-op.
    "^server-only$": "<rootDir>/lib/__mocks__/server-only.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
};

module.exports = config;

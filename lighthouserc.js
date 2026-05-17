// Lighthouse CI Configuration
// Validates: Requirements 10.1, 10.2, 10.3, 10.4
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/", "http://localhost:3000/dashboard"],
      numberOfRuns: 3,
    },
    assert: {
      preset: "lighthouse:no-pwa",
      assertions: {
        "categories:performance": ["error", { minScore: 0.7, aggregationMethod: "median-run" }],
      },
      assertMatrix: [
        {
          matchingUrlPattern: "http://localhost:3000/$",
          assertions: {
            "categories:performance": ["error", { minScore: 0.8, aggregationMethod: "median-run" }],
          },
        },
        {
          matchingUrlPattern: "http://localhost:3000/dashboard",
          assertions: {
            "categories:performance": ["error", { minScore: 0.7, aggregationMethod: "median-run" }],
          },
        },
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};

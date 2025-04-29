// jest.config.js
module.exports = {
  // Specifies the environment for the tests (Node.js environment)
  testEnvironment: "node",

  // Enables coverage collection for test runs
  collectCoverage: true,

  // Specifies the output directory for coverage reports
  coverageDirectory: "coverage",

  // Specifies the coverage reporters to use (HTML for a browsable report, text-summary for terminal with line numbers)
  coverageReporters: ["html", "text", "text-summary"],

  // Collect coverage from specific files and directories (in this case, all files in models and app.js)
  collectCoverageFrom: ["models/**/*.js", "app.js"],

  // Specifies the test files Jest will look for (all .test.js files inside __tests__ directories)
  testMatch: ["**/__tests__/**/*.test.js"],

  // Defines coverage thresholds (tests must meet these thresholds to pass)
  coverageThreshold: {
    global: {
      branches: 70, // Require at least 70% branch coverage
      functions: 70, // Require at least 70% function coverage
      lines: 70, // Require at least 70% line coverage
      statements: 70, // Require at least 70% statement coverage
    },
  },

  // Optional: Can add a test timeout for longer-running tests (e.g., database-related tests)
  testTimeout: 10000, // Adjust timeout if necessary (10 seconds here)

  // Enables more detailed logging in Jest
  verbose: true, // To see more details in the terminal for each test
};

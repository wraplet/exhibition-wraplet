/** @jest-config-loader esbuild-register */
/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "jsdom",
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  preset: "ts-jest",
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  testPathIgnorePatterns: [
    "/tests/functional/",
  ],
  coveragePathIgnorePatterns: [
    "index.ts",
    "/tests/functional/",
  ],
};

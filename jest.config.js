module.exports = {
  transform: {
    "\\.[jt]sx?$": "babel-jest",
  },
  transformIgnorePatterns: ["[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverageFrom: ["src/**/*.{ts,tsx,js,jsx}"],
  testMatch: ["<rootDir>/**/*.(spec|test).{ts,tsx,js,jsx}"],
  rootDir: "./",
  setupFilesAfterEnv: ["./setupTests.js"],
};

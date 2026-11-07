import { defineConfig } from 'vitest/config'

// Unit tests for the plain-JS logic (fees, permissions, bridges). No browser needed: the setup file
// gives the tests an in-memory localStorage, like the one the bridges read and write.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.js'],
  },
})

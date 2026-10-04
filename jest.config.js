/**
 * The transform matches `.ts`/`.tsx` only — never `.js` — so @swc/jest never
 * tries to recompile already-built output.
 *
 * No reflect-metadata or decorator transform: this package has no Nest
 * dependency and no decorators.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
        },
      },
    ],
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src/"],
  setupFilesAfterEnv: ["jest-extended/all"],
}

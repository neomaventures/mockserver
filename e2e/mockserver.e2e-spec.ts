import request from "supertest"

import { MockServerClient } from "@neomaventures/mockserver"

/**
 * End-to-end check against a real container, consuming the package the
 * way an installer would: imports resolve to the built `dist` at runtime
 * (see e2e/jest-e2e.json), and the container is started by the built
 * `setup` drop-in (globalSetup, via dist/setup.js). Types still resolve
 * to `src` (tsconfig paths) so goto-definition and debugging stay on
 * source.
 */
describe("@neomaventures/mockserver (e2e)", () => {
  // The container is started by `pretest:e2e` and waited for in globalSetup;
  // .env.e2e supplies the URL it was published on.
  const controlUrl = (): string => process.env.MOCKSERVER_URL ?? ""
  const mockUrl = (): string => new URL(controlUrl()).origin

  let client: MockServerClient

  beforeAll(() => {
    client = new MockServerClient(controlUrl())
  })

  beforeEach(async () => {
    await client.reset()
  })

  describe("when a configured expectation is matched against the live container", () => {
    beforeEach(async () => {
      await client.createExpectation({
        httpRequest: { path: "/health", method: "GET" },
        httpResponse: { statusCode: 200, body: "ok" },
        times: { unlimited: true },
      })
    })

    it("should respond with HTTP 200 and the configured body", async () => {
      await request(mockUrl()).get("/health").expect(200, "ok")
    })

    it("should verify the expectation was matched", async () => {
      await request(mockUrl()).get("/health").expect(200)

      expect(
        await client.verifyExpectationMatched({
          path: "/health",
          method: "GET",
        }),
      ).toBeTrue()
    })
  })
})

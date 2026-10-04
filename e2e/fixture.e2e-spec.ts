import request from "supertest"

import { mockserver } from "@neomaventures/mockserver/fixture"

/**
 * Verifies the `/fixture` subpath against the real container started by the
 * package's `globalSetup`. The first test registers a "leak-check"
 * expectation; the second test confirms the fixture's `beforeEach` hook
 * cleared it. If auto-reset is broken, the second test sees the leaked
 * expectation and fails.
 */
describe("@neomaventures/mockserver/fixture (e2e)", () => {
  // Single source of truth: the control URL from .env.e2e, which the compose
  // port binding matches. Deriving a port separately lets the two drift.
  const mockUrl = new URL(process.env.MOCKSERVER_URL ?? "").origin

  describe("first test creates a leak-check expectation", () => {
    beforeEach(async () => {
      await mockserver.createExpectation({
        httpRequest: { path: "/leak-check", method: "GET" },
        httpResponse: { statusCode: 200, body: "leaked" },
        times: { unlimited: true },
      })
    })

    it("should respond with HTTP 200 and the configured body", async () => {
      await request(mockUrl).get("/leak-check").expect(200, "leaked")
    })
  })

  it("second test sees no leaked expectation (proves auto-reset)", async () => {
    await request(mockUrl).get("/leak-check").expect(404)
  })
})

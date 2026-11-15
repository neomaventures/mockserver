import { MockserverVerificationError } from "./errors"
import { MockserverTimes } from "./times"
import { type MockserverExpectation, type MockserverHttpRequest } from "./types"

/**
 * HTTP client for interacting with a MockServer instance.
 *
 * Provides methods to reset expectations, register new expectations,
 * and verify that expected requests were received.
 *
 * @example
 * ```typescript
 * const client = new MockServerClient("http://localhost:1080/mockserver")
 * await client.reset()
 * await client.createExpectation({
 *   httpRequest: { path: "/api/users", method: "GET" },
 *   httpResponse: { statusCode: 200, body: "[]" },
 *   times: MockserverTimes.Infinite,
 * })
 * const matched = await client.verifyExpectationMatched(
 *   { path: "/api/users", method: "GET" },
 * )
 * ```
 */
export class MockServerClient {
  /**
   * @param baseUrl - The base URL of the MockServer instance
   *   (e.g. `http://localhost:1080/mockserver`)
   */
  public constructor(public readonly baseUrl: string) {}

  /**
   * Resets all expectations on the MockServer instance.
   *
   * @throws {Error} When the MockServer returns a non-2xx response
   *
   * @example
   * ```typescript
   * await client.reset()
   * ```
   */
  public async reset(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/reset`, { method: "PUT" })

    if (!response.ok) {
      throw new Error(
        `Error resetting mock server ${this.baseUrl}: ${response.status}`,
      )
    }
  }

  /**
   * Registers an expectation (a request to match and a response to return)
   * on the MockServer instance. It matches once unless its `times` says
   * otherwise.
   *
   * @param expectation - The expectation to register
   *
   * @throws {TypeError} When `times` is given as `undefined`; leave it out
   *   to match once
   * @throws {Error} When the MockServer returns a non-2xx response
   *
   * @example
   * ```typescript
   * await client.createExpectation({
   *   httpRequest: { path: "/api/users", method: "GET" },
   *   httpResponse: { statusCode: 200, body: "[]" },
   *   times: MockserverTimes.Infinite,
   * })
   * ```
   */
  public async createExpectation(
    expectation: MockserverExpectation,
  ): Promise<void> {
    if ("times" in expectation && expectation.times === undefined) {
      throw new TypeError(
        "An expectation's times can't be undefined: leave it out to match once.",
      )
    }

    const response = await fetch(`${this.baseUrl}/expectation`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ times: MockserverTimes.Once, ...expectation }),
    })

    if (!response.ok) {
      throw new Error(
        `Error creating expectation on ${this.baseUrl}: ${response.status} ${await response.text()}`,
      )
    }
  }

  /**
   * Registers several expectations in one request, in the order given,
   * which is the order MockServer tries them in, e.g. a sequence of answers
   * to the same request. Each matches once unless its `times` says
   * otherwise.
   *
   * @param expectations - The expectations to register
   *
   * @throws {TypeError} When any expectation's `times` is given as
   *   `undefined`; leave it out to match once
   * @throws {Error} When the MockServer returns a non-2xx response
   *
   * @example
   * ```typescript
   * await client.createExpectations([
   *   {
   *     httpRequest: { path: "/api/jobs/1", method: "GET" },
   *     httpResponse: { statusCode: 200, body: '{"status":"running"}' },
   *   },
   *   {
   *     httpRequest: { path: "/api/jobs/1", method: "GET" },
   *     httpResponse: { statusCode: 200, body: '{"status":"done"}' },
   *   },
   * ])
   * ```
   */
  public async createExpectations(
    expectations: MockserverExpectation[],
  ): Promise<void> {
    if (expectations.length === 0) return
    if (
      expectations.some(
        (expectation) =>
          "times" in expectation && expectation.times === undefined,
      )
    ) {
      throw new TypeError(
        "An expectation's times can't be undefined: leave it out to match once.",
      )
    }

    const response = await fetch(`${this.baseUrl}/expectation`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        expectations.map((expectation) => ({
          times: MockserverTimes.Once,
          ...expectation,
        })),
      ),
    })

    if (!response.ok) {
      throw new Error(
        `Error creating expectations on ${this.baseUrl}: ${response.status} ${await response.text()}`,
      )
    }
  }

  /**
   * Verifies that MockServer received a request a number of times, failing
   * with MockServer's explanation when it didn't.
   *
   * @param httpRequest - The request to look for
   * @param times - Exactly how many times it should have been received, or
   *   at least and at most how many. Defaults to exactly `1`.
   *
   * @throws {MockserverVerificationError} When the request wasn't received
   *   that many times; its message says what MockServer expected and the
   *   requests it received
   * @throws {Error} When the MockServer returns any other non-2xx response
   *
   * @example
   * ```typescript
   * await client.verify({ path: "/api/users", method: "GET" }, 2)
   * await client.verify({ path: "/api/users", method: "GET" }, { atLeast: 1 })
   * ```
   */
  public async verify(
    httpRequest: MockserverHttpRequest,
    times: number | { atLeast?: number; atMost?: number } = 1,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/verify`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        httpRequest,
        times:
          typeof times === "number" ? { atLeast: times, atMost: times } : times,
      }),
    })

    if (response.ok) return

    const explanation = await response.text()
    if (response.status === 406) {
      throw new MockserverVerificationError(explanation)
    }

    throw new Error(
      `Error verifying expectation on ${this.baseUrl}: ${response.status} ${explanation}`,
    )
  }

  /**
   * Verifies that a specific request was made a certain number of times
   * against the MockServer instance.
   *
   * @param httpRequest - The request pattern to verify
   * @param count - The exact number of times the request should have been
   *   made. Defaults to `1`.
   *
   * @returns `true` if the request was matched exactly `count` times,
   *   otherwise `false`
   *
   * @example
   * ```typescript
   * const matched = await client.verifyExpectationMatched(
   *   { path: "/api/users", method: "GET" },
   * )
   * ```
   */
  public async verifyExpectationMatched(
    httpRequest: MockserverHttpRequest,
    count: number = 1,
  ): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/verify`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        httpRequest,
        times: {
          atLeast: count,
          atMost: count,
        },
      }),
    })

    if (response.ok) {
      return true
    }

    if (response.status === 406) {
      return false
    }

    throw new Error(
      `Error verifying expectation on ${this.baseUrl}: ${response.status} ${await response.text()}`,
    )
  }
}

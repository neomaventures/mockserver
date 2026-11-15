import {
  type MockserverSpecificTimes,
  type MockserverUnlimitedTimes,
} from "./types"

/**
 * How many times an expectation matches, for its `times`. Without `times`,
 * an expectation matches once.
 */
export const MockserverTimes = {
  /**
   * Matches once: the default.
   */
  Once: { remainingTimes: 1 } satisfies MockserverSpecificTimes,

  /**
   * Matches every time.
   */
  Infinite: { unlimited: true } satisfies MockserverUnlimitedTimes,
} as const

/**
 * Matches `count` times, for an expectation's `times`.
 *
 * @param count - How many times the expectation matches.
 *
 * @returns The times.
 *
 * @example
 * ```typescript
 * await client.createExpectation({ httpRequest, httpResponse, times: times(3) })
 * ```
 */
export const times = (count: number): MockserverSpecificTimes => ({
  remainingTimes: count,
})

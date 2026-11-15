/**
 * Thrown by {@link MockServerClient.verify} when MockServer didn't receive
 * a request the expected number of times. Its message is MockServer's
 * explanation: what it expected, and the requests it received.
 */
export class MockserverVerificationError extends Error {
  public override readonly name = "MockserverVerificationError"
}

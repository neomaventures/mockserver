/**
 * Controls how MockServer matches request bodies.
 */
export enum MockserverMatchTypes {
  Strict = "STRICT",
  OnlyMatchingFields = "ONLY_MATCHING_FIELDS",
}

/**
 * How a MockServer request body is matched.
 */
export enum MockserverBodyTypes {
  /**
   * As JSON, strictly or by only the fields given.
   */
  JSON = "JSON",

  /**
   * As form parameters.
   */
  Form = "PARAMETERS",

  /**
   * As raw bytes, byte for byte.
   */
  Binary = "BINARY",

  /**
   * As text, whole or as a substring.
   */
  String = "STRING",
}

/**
 * Matches a JSON request body: all of it with
 * {@link MockserverMatchTypes.Strict}, or only the fields given with
 * {@link MockserverMatchTypes.OnlyMatchingFields} (MockServer's default).
 */
export type MockserverJsonBody = {
  type: MockserverBodyTypes.JSON
  json: Record<string, any>
  matchType?: MockserverMatchTypes
}

/**
 * Matches a form-encoded request body by its parameters.
 */
export type MockserverFormBody = {
  type: MockserverBodyTypes.Form
  parameters: Record<string, string[]>
}

/**
 * Matches a request body byte for byte, e.g. an uploaded file.
 */
export type MockserverBinaryBody = {
  type: MockserverBodyTypes.Binary

  /**
   * The bytes, base64-encoded, e.g. `buffer.toString("base64")`.
   */
  base64Bytes: string
}

/**
 * Matches a text request body, whole or, with `subString`, containing it.
 */
export type MockserverStringBody = {
  type: MockserverBodyTypes.String
  string: string
  subString?: boolean
}

/**
 * Matches a request body, by one of the ways MockServer can.
 */
export type MockserverRequestBody =
  | MockserverJsonBody
  | MockserverFormBody
  | MockserverBinaryBody
  | MockserverStringBody

/**
 * Limits an expectation to a fixed number of matches.
 */
export type MockserverSpecificTimes = {
  remainingTimes: number
}

/**
 * Allows an expectation to match an unlimited number of times.
 */
export type MockserverUnlimitedTimes = {
  unlimited: boolean
}

/**
 * Describes an HTTP request to match in MockServer.
 */
export type MockserverHttpRequest = {
  path: string
  method: string
  headers?: Record<string, string[]>
  queryStringParameters?: Record<string, string[]>
  body?: MockserverRequestBody
}

/**
 * Describes the HTTP response MockServer should return when
 * a matching request is received.
 */
export type MockserverHttpResponse = {
  statusCode: number
  body: string
  headers?: Record<string, string[]>
  delay?: {
    timeUnit: "MILLISECONDS"
    value: number
  }
  connectionOptions?: MockserverConnectionOptions
}

/**
 * How MockServer handles the connection a response is sent on, e.g. to
 * drop it part way through the body: `{ contentLengthHeaderOverride: 100,
 * closeSocket: true }` with a shorter body makes `fetch` resolve on the
 * headers, then fail reading the body.
 */
export type MockserverConnectionOptions = {
  /**
   * Closes the socket once the response is sent.
   */
  closeSocket?: boolean

  /**
   * How long after the response is sent to close the socket.
   */
  closeSocketDelay?: {
    timeUnit: "MILLISECONDS"
    value: number
  }

  /**
   * Sends this as `Content-Length`, whatever the body's length.
   */
  contentLengthHeaderOverride?: number

  /**
   * Sends no `Content-Length` header.
   */
  suppressContentLengthHeader?: boolean

  /**
   * Overrides whether the connection is kept alive.
   */
  keepAliveOverride?: boolean

  /**
   * Sends no `Connection` header.
   */
  suppressConnectionHeader?: boolean
}

/**
 * Describes an HTTP error MockServer should simulate when
 * a matching request is received.
 */
export type MockserverHttpError = {
  dropConnection: boolean
  delay?: {
    timeUnit: "MILLISECONDS"
    value: number
  }
}

/**
 * A full MockServer expectation comprising the request to match,
 * the response or error to return, and how many times to match: once,
 * unless `times` says otherwise (e.g. `MockserverTimes.Infinite` or
 * `times(3)`).
 */
export type MockserverExpectation = {
  httpRequest: MockserverHttpRequest
  httpResponse?: MockserverHttpResponse
  httpError?: MockserverHttpError
  times?: MockserverSpecificTimes | MockserverUnlimitedTimes
}

/**
 * A request MockServer received, as {@link MockServerClient.retrieveRecordedRequests}
 * reads it back.
 *
 * @typeParam Json - What a JSON body is read as; `unknown` unless the
 *   caller says otherwise, which it can't check.
 */
export type MockserverRecordedRequest<Json = unknown> = {
  method: string
  path: string

  /**
   * The headers, by lower-cased name: HTTP's names are case-insensitive, so
   * `headers["content-type"]` finds the header however it was sent.
   */
  headers: Record<string, string[]>

  /**
   * The headers, by name as the sender cased it.
   */
  rawHeaders: Record<string, string[]>

  /**
   * The query string's parameters; empty when there were none.
   */
  queryStringParameters: Record<string, string[]>

  /**
   * The body; absent when there was none.
   */
  body?: MockserverRecordedBody<Json>
}

/**
 * A received request's body, by how MockServer read it. Each carries its
 * `bytes` exactly as received.
 *
 * @typeParam Json - What a JSON body is read as.
 */
export type MockserverRecordedBody<Json = unknown> =
  | MockserverRecordedJsonBody<Json>
  | MockserverRecordedStringBody
  | MockserverRecordedBinaryBody

/**
 * A received body MockServer read as JSON.
 */
export type MockserverRecordedJsonBody<Json = unknown> = {
  type: "JSON"
  json: Json
  contentType?: string
  bytes: Buffer
}

/**
 * A received body MockServer read as text, including a form's.
 */
export type MockserverRecordedStringBody = {
  type: "STRING"
  string: string
  contentType?: string
  bytes: Buffer
}

/**
 * A received body MockServer read as raw bytes.
 */
export type MockserverRecordedBinaryBody = {
  type: "BINARY"
  contentType?: string
  bytes: Buffer
}

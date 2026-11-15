import {
  type MockserverRecordedBody,
  type MockserverRecordedRequest,
} from "./types"

/**
 * A request as MockServer's `retrieve` returns it in its JSON format.
 */
export type MockserverRetrievedRequest = {
  method: string
  path: string
  headers?: Record<string, string[]>
  queryStringParameters?: Record<string, string[]>
  body?: {
    type: string
    json?: unknown
    string?: string
    xml?: string
    rawBytes?: string
    base64Bytes?: string
    contentType?: string
  } | null
}

/**
 * Reads a request MockServer returned into a {@link MockserverRecordedRequest}:
 * headers by lower-cased name beside the names as sent, an empty query
 * string when there was none, and its body with its bytes.
 *
 * @param retrieved - The request as MockServer returned it.
 *
 * @returns The recorded request.
 */
export function recordedRequest<Json>(
  retrieved: MockserverRetrievedRequest,
): MockserverRecordedRequest<Json> {
  const rawHeaders = retrieved.headers ?? {}
  const headers: Record<string, string[]> = {}
  for (const [name, values] of Object.entries(rawHeaders)) {
    const key = name.toLowerCase()
    headers[key] = [...(headers[key] ?? []), ...values]
  }

  return {
    method: retrieved.method,
    path: retrieved.path,
    headers,
    rawHeaders,
    queryStringParameters: retrieved.queryStringParameters ?? {},
    ...(retrieved.body ? { body: recordedBody<Json>(retrieved.body) } : {}),
  }
}

/**
 * Reads a body MockServer returned, by how it read it: JSON, binary, or
 * otherwise text.
 *
 * @param body - The body as MockServer returned it.
 *
 * @returns The recorded body.
 */
function recordedBody<Json>(
  body: NonNullable<MockserverRetrievedRequest["body"]>,
): MockserverRecordedBody<Json> {
  const contentType = body.contentType ? { contentType: body.contentType } : {}

  if (body.type === "JSON") {
    return {
      type: "JSON",
      json: body.json as Json,
      ...contentType,
      bytes: body.rawBytes
        ? Buffer.from(body.rawBytes, "base64")
        : Buffer.from(JSON.stringify(body.json)),
    }
  }

  if (body.type === "BINARY") {
    return {
      type: "BINARY",
      ...contentType,
      bytes: Buffer.from(body.base64Bytes ?? body.rawBytes ?? "", "base64"),
    }
  }

  const string = body.string ?? body.xml ?? ""
  return {
    type: "STRING",
    string,
    ...contentType,
    bytes: body.rawBytes
      ? Buffer.from(body.rawBytes, "base64")
      : Buffer.from(string),
  }
}

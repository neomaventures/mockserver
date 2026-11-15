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
  /**
   * One of MockServer's typed bodies, or, for JSON sent with a charset
   * (e.g. `application/json; charset=UTF-8`), the JSON itself.
   */
  body?: MockserverRetrievedBody | unknown
}

/**
 * A body as MockServer's `retrieve` returns it, typed by how it read it.
 */
type MockserverRetrievedBody = {
  type: string
  json?: unknown
  string?: string
  xml?: string
  rawBytes?: string
  base64Bytes?: string
  contentType?: string
}

/**
 * The field each of MockServer's typed bodies keeps its content in.
 */
const CONTENT: Record<string, keyof MockserverRetrievedBody> = {
  JSON: "json",
  STRING: "string",
  BINARY: "base64Bytes",
  XML: "xml",
}

/**
 * Whether a body MockServer returned is one of its typed bodies, rather
 * than bare JSON: it has a type MockServer gives, and that type's content.
 *
 * @param body - The body as MockServer returned it.
 *
 * @returns Whether it's a typed body.
 */
function isTyped(body: unknown): body is MockserverRetrievedBody {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }

  const { type } = body as { type?: unknown }
  return typeof type === "string" && type in CONTENT && CONTENT[type]! in body
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
    ...(retrieved.body !== undefined && retrieved.body !== null
      ? { body: recordedBody<Json>(retrieved.body, headers) }
      : {}),
  }
}

/**
 * Reads a body MockServer returned, by how it read it: JSON, binary, or
 * otherwise text. A body that isn't one of its typed bodies is JSON sent
 * with a charset, which MockServer returns bare, without its raw bytes.
 *
 * @param body - The body as MockServer returned it.
 * @param headers - The request's headers, by lower-cased name, for a bare
 *   JSON body's content type.
 *
 * @returns The recorded body.
 */
function recordedBody<Json>(
  body: unknown,
  headers: Record<string, string[]>,
): MockserverRecordedBody<Json> {
  if (!isTyped(body)) {
    const contentType = headers["content-type"]?.[0]
    return {
      type: "JSON",
      json: body as Json,
      ...(contentType ? { contentType } : {}),
      bytes: Buffer.from(JSON.stringify(body)),
    }
  }

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

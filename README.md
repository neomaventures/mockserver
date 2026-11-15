# @neomaventures/mockserver

A typed client for MockServer's REST API. Stub and verify HTTP expectations from your tests; container lifecycle stays with your harness.

[![npm version](https://img.shields.io/npm/v/%40neomaventures%2Fmockserver)](https://www.npmjs.com/package/@neomaventures/mockserver)
[![CI](https://github.com/neomaventures/mockserver/actions/workflows/ci.yml/badge.svg)](https://github.com/neomaventures/mockserver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Requirements

- Node ≥ 22
- A running MockServer. This package does **not** start one — see [Running MockServer](#running-mockserver).

## Installation

```bash
npm install --save-dev @neomaventures/mockserver
```

## Quick start

Point `MockServerClient` at a running MockServer and drive it.

```typescript
import { MockServerClient } from "@neomaventures/mockserver"

const client = new MockServerClient(process.env.MOCKSERVER_URL)

await client.reset()
await client.createExpectation({
  httpRequest: { path: "/api/users", method: "GET" },
  httpResponse: { statusCode: 200, body: "[]" },
})

// ...exercise the code under test, which calls the mocked endpoint...

await client.verify({ path: "/api/users", method: "GET" })
```

`verify` resolves when MockServer received the request exactly once (or `verify(request, 3)`, or `verify(request, { atLeast: 1 })`), and otherwise rejects with a `MockserverVerificationError` whose message is MockServer's explanation: what it expected, and the requests it received. `verifyExpectationMatched` returns the same answer as a boolean.

## Reading what was sent

`retrieveRecordedRequests` reads back the requests MockServer received that match a request, or all of them, in the order they arrived. A spec can then stub leniently and assert what the code sent, with Jest's diff, rather than through a strict matcher that fails with MockServer's `404`:

```typescript
const [sent] = await client.retrieveRecordedRequests({
  path: "/api/users",
  method: "POST",
})

expect(sent.body).toMatchObject({ type: "JSON", json: { name: "Ada" } })
expect(sent.headers["content-type"]).toEqual(["application/json"])
```

Each request has its `method`, `path`, `queryStringParameters` (empty when there were none), `headers` by lower-cased name, `rawHeaders` by name as sent, and its `body` if it had one: `{ type: "JSON", json }`, `{ type: "STRING", string }` (text, and forms) or `{ type: "BINARY" }`, each with its `bytes` as received. A JSON body's `json` is `unknown` unless you say otherwise (`retrieveRecordedRequests<User>(...)`), which the client can't check. `reset()` clears them.

## How many times an expectation matches

An expectation matches **once** unless its `times` says otherwise:

```typescript
import { MockserverTimes, times } from "@neomaventures/mockserver"

await client.createExpectation({ httpRequest, httpResponse }) // once
await client.createExpectation({ httpRequest, httpResponse, times: times(3) }) // three times
await client.createExpectation({
  httpRequest,
  httpResponse,
  times: MockserverTimes.Infinite,
}) // every time
```

MockServer's own default, when `times` is left out of the request, is every time; the client sends once instead.

## Matching request bodies

`httpRequest.body` takes any of MockServer's body matchers, by `type`:

```typescript
import { MockserverBodyTypes, MockserverMatchTypes } from "@neomaventures/mockserver"

// JSON: all of it, or only the fields given (MockServer's default)
body: { type: MockserverBodyTypes.JSON, json: { name: "invoice.pdf" }, matchType: MockserverMatchTypes.Strict }

// Form parameters
body: { type: MockserverBodyTypes.Form, parameters: { grant_type: ["authorization_code"] } }

// Raw bytes, byte for byte, e.g. an upload
body: { type: MockserverBodyTypes.Binary, base64Bytes: content.toString("base64") }

// Text, whole or as a substring
body: { type: MockserverBodyTypes.String, string: "needle", subString: true }
```

## Dropping a connection

`httpError: { dropConnection: true }` drops the connection without a response. To drop it part way through a response's body, so `fetch` resolves on the headers and then fails reading the body, use `connectionOptions`:

```typescript
await client.createExpectation({
  httpRequest: { path: "/token", method: "POST" },
  httpResponse: {
    statusCode: 200,
    body: '{"access_tok',
    connectionOptions: { contentLengthHeaderOverride: 100, closeSocket: true },
  },
})
```

## Several expectations at once

`createExpectations` registers a list in one request, in order; MockServer tries expectations in the order they were created, so a sequence of answers to the same request reads top to bottom:

```typescript
await client.createExpectations(
  pages.map((page) => ({
    httpRequest: { path: "/api/messages", method: "GET" },
    httpResponse: { statusCode: 200, body: JSON.stringify(page) },
  })),
)
```

## Auto-reset fixture

For test suites that want a single shared client and an automatic `reset()` between tests, import the `/fixture` subpath:

```typescript
import { mockserver } from "@neomaventures/mockserver/fixture"

it("returns the mocked body", async () => {
  await mockserver.createExpectation({
    httpRequest: { path: "/api/users", method: "GET" },
    httpResponse: { statusCode: 200, body: "[]" },
  })

  // ...exercise the code under test...
})
```

Importing the subpath:

- Constructs a singleton `MockServerClient` from `process.env.MOCKSERVER_URL`. The variable **must** be set before the module is imported (typically via an `.env.e2e` consumed by `node --env-file` or via a Jest `globalSetup` that runs first). If it is unset or empty, importing throws.
- Registers `beforeEach(() => mockserver.reset())` if the host runner exposes `beforeEach` globally (Jest, Vitest). Playwright Test does not expose a global `beforeEach` — call `await mockserver.reset()` from your own `test.beforeEach` instead.

Suites that test `MockServerClient` itself, or that need multiple independent clients (e.g. per-suite isolated containers), should keep constructing the class directly.

## Running MockServer

This package is the client only. Starting and stopping the server belongs to
your test harness, so one container can serve a whole suite — or a whole
monorepo — rather than each package starting its own.

```yaml
# docker-compose.yml
services:
  mockserver:
    image: mockserver/mockserver:5.15.0
    ports:
      - "2100:1080"
```

```json
{
  "scripts": {
    "pretest:e2e": "docker compose up -d --wait",
    "test:e2e": "node --env-file=.env.e2e jest --config ./e2e/jest-e2e.json",
    "posttest:e2e": "docker compose down"
  }
}
```

```bash
# .env.e2e
MOCKSERVER_URL=http://localhost:2100/mockserver
```

### Waiting for readiness

The MockServer image ships no `HEALTHCHECK`, so `docker compose up --wait`
reports success as soon as the container is _running_ — which is not the same
as accepting requests. Poll for readiness in a Jest `globalSetup`:

```typescript
import { waitForHttp } from "@neomaventures/wait-for"

export default async function setup(): Promise<void> {
  await waitForHttp(`${process.env.MOCKSERVER_URL}/status`, { method: "PUT" })
}
```

`@neomaventures/wait-for` polls from the host, so it needs no probe inside the
container. Any equivalent will do.

## Configuration

One variable:

| Variable         | Purpose                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MOCKSERVER_URL` | Control-API URL, e.g. `http://localhost:2100/mockserver`. Required by `@neomaventures/mockserver/fixture` at import time, and the natural thing to pass to `MockServerClient`. |

There is no port or container-name configuration: the port is whatever your
compose file binds, and nothing here names a container.

**Running suites in parallel?** Give each one its own MockServer rather than
sharing — expectations are global to the server, and `reset()` clears all of
them, so two suites against one instance will clear each other's stubs.

## API

- **`MockServerClient`** — `reset()`, `createExpectation(expectation)`, `createExpectations(expectations)`, `retrieveRecordedRequests(request?)`, `verify(request, times?)`, `verifyExpectationMatched(request, count?)`.
- **`MockserverTimes`** (`Once`, `Infinite`) and **`times(count)`** — an expectation's `times`; once by default.
- **`MockserverVerificationError`** — what `verify` rejects with when a request wasn't received as expected.
- **`@neomaventures/mockserver/fixture`** — singleton `mockserver` client wired from `MOCKSERVER_URL` with an auto-reset `beforeEach` hook.

## License

MIT

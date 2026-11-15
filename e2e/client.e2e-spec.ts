import { faker } from "@faker-js/faker"
import request from "supertest"

import {
  MockserverBodyTypes,
  MockServerClient,
  type MockserverExpectation,
  MockserverTimes,
  times,
  MockserverVerificationError,
} from "@neomaventures/mockserver"

describe("MockServerClient", () => {
  // The container is started by `pretest:e2e` and waited for in globalSetup,
  // so this suite only needs the URL it was published on.
  const url = process.env.MOCKSERVER_URL ?? ""
  const client = new MockServerClient(url)
  const baseUrl = new URL(url).origin

  beforeEach(async () => {
    await client.reset()
  })

  describe("reset()", () => {
    describe("Given an active expectation", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 200, body: "ok" },
          times: { unlimited: true },
        })

        await client.reset()
      })

      it("should clear all expectations", async () => {
        await request(baseUrl).get(path).expect(404)
      })
    })
  })

  describe("createExpectation()", () => {
    describe("Given an expectation is registered", () => {
      let responseBody: string
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`
        responseBody = JSON.stringify({ id: faker.string.uuid() })

        const expectation: MockserverExpectation = {
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 201, body: responseBody },
          times: { unlimited: true },
        }

        await client.createExpectation(expectation)
      })

      it("should respond with the configured status and body", async () => {
        await request(baseUrl).get(path).expect(201, responseBody)
      })
    })

    describe("Given an expectation without times", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 200, body: "once" },
        })
      })

      it("should match once", async () => {
        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(404)
      })
    })

    describe("Given an expectation whose times is undefined", () => {
      it("should reject it", async () => {
        await expect(
          client.createExpectation({
            httpRequest: { path: `/${faker.word.noun()}`, method: "GET" },
            httpResponse: { statusCode: 200, body: "ok" },
            times: undefined,
          }),
        ).rejects.toThrow(TypeError)
      })
    })

    describe("Given an expectation matching a number of times", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 200, body: "ok" },
          times: times(3),
        })
      })

      it("should match that many times", async () => {
        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(404)
      })
    })

    describe("Given an expectation matching infinitely", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 200, body: "ok" },
          times: MockserverTimes.Infinite,
        })
      })

      it("should match every time", async () => {
        for (let request_ = 0; request_ < 5; request_++) {
          await request(baseUrl).get(path).expect(200)
        }
      })
    })
  })

  describe("createExpectation() with a body matcher", () => {
    let path: string

    beforeEach(() => {
      path = `/${faker.word.noun()}`
    })

    describe("Given a binary body", () => {
      const bytes = Buffer.from(
        faker.helpers.multiple(() => faker.number.int(255), { count: 64 }),
      )

      beforeEach(async () => {
        await client.createExpectation({
          httpRequest: {
            path,
            method: "PUT",
            body: {
              type: MockserverBodyTypes.Binary,
              base64Bytes: bytes.toString("base64"),
            },
          },
          httpResponse: { statusCode: 200, body: "matched" },
          times: { unlimited: true },
        })
      })

      it("should match a request with the same bytes", async () => {
        await request(baseUrl)
          .put(path)
          .set("Content-Type", "application/octet-stream")
          .send(bytes)
          .expect(200, "matched")
      })

      it("should not match a request with other bytes", async () => {
        await request(baseUrl)
          .put(path)
          .set("Content-Type", "application/octet-stream")
          .send(Buffer.concat([bytes, Buffer.from([0])]))
          .expect(404)
      })
    })

    describe("Given a string body", () => {
      const text = faker.lorem.sentence()

      beforeEach(async () => {
        await client.createExpectation({
          httpRequest: {
            path,
            method: "POST",
            body: { type: MockserverBodyTypes.String, string: text },
          },
          httpResponse: { statusCode: 200, body: "matched" },
          times: { unlimited: true },
        })
      })

      it("should match a request with the same text", async () => {
        await request(baseUrl)
          .post(path)
          .set("Content-Type", "text/plain")
          .send(text)
          .expect(200, "matched")
      })

      it("should not match a request containing more", async () => {
        await request(baseUrl)
          .post(path)
          .set("Content-Type", "text/plain")
          .send(`${text} and more`)
          .expect(404)
      })
    })

    describe("Given a string body matched as a substring", () => {
      const text = faker.lorem.word({ length: { min: 8, max: 12 } })

      beforeEach(async () => {
        await client.createExpectation({
          httpRequest: {
            path,
            method: "POST",
            body: {
              type: MockserverBodyTypes.String,
              string: text,
              subString: true,
            },
          },
          httpResponse: { statusCode: 200, body: "matched" },
          times: { unlimited: true },
        })
      })

      it("should match a request containing the text", async () => {
        await request(baseUrl)
          .post(path)
          .set("Content-Type", "text/plain")
          .send(`before ${text} after`)
          .expect(200, "matched")
      })

      it("should not match a request without it", async () => {
        await request(baseUrl)
          .post(path)
          .set("Content-Type", "text/plain")
          .send(faker.string.numeric(20))
          .expect(404)
      })
    })
  })

  describe("verify()", () => {
    let path: string

    beforeEach(async () => {
      path = `/${faker.word.noun()}`

      await client.createExpectation({
        httpRequest: { path, method: "GET" },
        httpResponse: { statusCode: 200, body: "ok" },
        times: { unlimited: true },
      })
    })

    describe("Given the request was received once", () => {
      beforeEach(async () => {
        await request(baseUrl).get(path).expect(200)
      })

      it("should resolve", async () => {
        await expect(
          client.verify({ path, method: "GET" }),
        ).resolves.toBeUndefined()
      })

      it("should resolve for at least once", async () => {
        await expect(
          client.verify({ path, method: "GET" }, { atLeast: 1 }),
        ).resolves.toBeUndefined()
      })

      it("should reject for twice, explaining what it received", async () => {
        await expect(client.verify({ path, method: "GET" }, 2)).rejects.toThrow(
          path,
        )
      })
    })

    describe("Given the request wasn't received", () => {
      it("should reject with a MockserverVerificationError", async () => {
        await expect(
          client.verify({ path, method: "GET" }),
        ).rejects.toBeInstanceOf(MockserverVerificationError)
      })
    })
  })

  describe("createExpectation() with connection options", () => {
    describe("Given the connection closes part way through the body", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: {
            statusCode: 200,
            headers: { "content-type": ["text/plain"] },
            body: "part of the bo",
            connectionOptions: {
              contentLengthHeaderOverride: 100,
              closeSocket: true,
            },
          },
          times: { remainingTimes: 1 },
        })
      })

      it("should fail reading the body", async () => {
        await expect(request(baseUrl).get(path)).rejects.toThrow()
      })
    })
  })

  describe("createExpectations()", () => {
    describe("Given several expectations for the same request", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectations(
          ["first", "second"].map((body) => ({
            httpRequest: { path, method: "GET" },
            httpResponse: { statusCode: 200, body },
          })),
        )
      })

      it("should answer with each once, in the order given", async () => {
        await request(baseUrl).get(path).expect(200, "first")
        await request(baseUrl).get(path).expect(200, "second")
        await request(baseUrl).get(path).expect(404)
      })
    })

    describe("Given an expectation whose times is undefined", () => {
      it("should reject them all", async () => {
        await expect(
          client.createExpectations([
            {
              httpRequest: { path: `/${faker.word.noun()}`, method: "GET" },
              httpResponse: { statusCode: 200, body: "ok" },
              times: undefined,
            },
          ]),
        ).rejects.toThrow(TypeError)
      })
    })

    describe("Given no expectations", () => {
      it("should register nothing", async () => {
        await expect(client.createExpectations([])).resolves.toBeUndefined()
      })
    })
  })

  describe("retrieveRecordedRequests()", () => {
    let path: string

    beforeEach(() => {
      path = `/${faker.word.noun()}`
    })

    describe("Given a JSON request", () => {
      const json = { requests: [{ updateCells: { rows: [1, 2] } }] }

      beforeEach(async () => {
        await request(baseUrl).post(`${path}?page=2`).send(json).expect(404)
      })

      it("should read back its method, path, query and JSON body", async () => {
        await expect(
          client.retrieveRecordedRequests({ path, method: "POST" }),
        ).resolves.toEqual([
          expect.objectContaining({
            method: "POST",
            path,
            queryStringParameters: { page: ["2"] },
            body: {
              type: "JSON",
              json,
              contentType: "application/json",
              bytes: Buffer.from(JSON.stringify(json)),
            },
          }),
        ])
      })
    })

    describe("Given a request with a header", () => {
      const value = faker.string.uuid()

      beforeEach(async () => {
        await request(baseUrl).get(path).set("X-Request-Id", value).expect(404)
      })

      it("should read it back by its lower-cased name", async () => {
        const [sent] = await client.retrieveRecordedRequests({
          path,
          method: "GET",
        })

        expect(sent?.headers["x-request-id"]).toEqual([value])
      })

      it("should read it back by its name as sent", async () => {
        const [sent] = await client.retrieveRecordedRequests({
          path,
          method: "GET",
        })

        expect(sent?.rawHeaders["X-Request-Id"]).toEqual([value])
      })
    })

    describe("Given a text request", () => {
      const text = faker.lorem.sentence()

      beforeEach(async () => {
        await request(baseUrl)
          .post(path)
          .set("Content-Type", "text/plain")
          .send(text)
          .expect(404)
      })

      it("should read back its body as a string", async () => {
        await expect(
          client.retrieveRecordedRequests({ path, method: "POST" }),
        ).resolves.toEqual([
          expect.objectContaining({
            body: {
              type: "STRING",
              string: text,
              contentType: "text/plain",
              bytes: Buffer.from(text),
            },
          }),
        ])
      })
    })

    describe("Given a form request", () => {
      beforeEach(async () => {
        await request(baseUrl)
          .post(path)
          .type("form")
          .send({ grant_type: "authorization_code", code: "abc" })
          .expect(404)
      })

      it("should read back its body as a string", async () => {
        await expect(
          client.retrieveRecordedRequests({ path, method: "POST" }),
        ).resolves.toEqual([
          expect.objectContaining({
            body: expect.objectContaining({
              type: "STRING",
              string: "grant_type=authorization_code&code=abc",
            }),
          }),
        ])
      })
    })

    describe("Given a binary request", () => {
      const bytes = Buffer.from(
        faker.helpers.multiple(() => faker.number.int(255), { count: 64 }),
      )

      beforeEach(async () => {
        await request(baseUrl)
          .put(path)
          .set("Content-Type", "application/octet-stream")
          .send(bytes)
          .expect(404)
      })

      it("should read back its bytes", async () => {
        await expect(
          client.retrieveRecordedRequests({ path, method: "PUT" }),
        ).resolves.toEqual([
          expect.objectContaining({
            body: {
              type: "BINARY",
              contentType: "application/octet-stream",
              bytes,
            },
          }),
        ])
      })
    })

    describe("Given a request without a body or query", () => {
      beforeEach(async () => {
        await request(baseUrl).get(path).expect(404)
      })

      it("should read it back without a body, and with an empty query", async () => {
        const [sent] = await client.retrieveRecordedRequests({
          path,
          method: "GET",
        })

        expect(sent).toEqual({
          method: "GET",
          path,
          headers: expect.any(Object),
          rawHeaders: expect.any(Object),
          queryStringParameters: {},
        })
      })
    })

    describe("Given several requests", () => {
      const others = [`/${faker.string.uuid()}`, `/${faker.string.uuid()}`]

      beforeEach(async () => {
        await request(baseUrl).get(others[0]!).expect(404)
        await request(baseUrl).get(path).expect(404)
        await request(baseUrl).get(others[1]!).expect(404)
      })

      it("should read back only those matching", async () => {
        await expect(
          client.retrieveRecordedRequests({ path, method: "GET" }),
        ).resolves.toEqual([expect.objectContaining({ path })])
      })

      it("should read back all of them without a matcher, in the order they arrived", async () => {
        const sent = await client.retrieveRecordedRequests()

        expect(sent.map(({ path }) => path)).toEqual([
          others[0],
          path,
          others[1],
        ])
      })

      it("should read back none once reset", async () => {
        await client.reset()

        await expect(client.retrieveRecordedRequests()).resolves.toEqual([])
      })
    })
  })

  describe("verifyExpectationMatched()", () => {
    it("should return true when a request was matched", async () => {
      const path = `/${faker.word.noun()}`

      await client.createExpectation({
        httpRequest: { path, method: "GET" },
        httpResponse: { statusCode: 200, body: "ok" },
        times: { unlimited: true },
      })

      await request(baseUrl).get(path).expect(200)

      const matched = await client.verifyExpectationMatched({
        path,
        method: "GET",
      })

      expect(matched).toBeTrue()
    })

    it("should return false for unmatched requests", async () => {
      const path = `/${faker.word.noun()}`

      const matched = await client.verifyExpectationMatched({
        path,
        method: "GET",
      })

      expect(matched).toBeFalse()
    })

    describe("Given a custom count parameter and three matching requests", () => {
      let path: string

      beforeEach(async () => {
        path = `/${faker.word.noun()}`

        await client.createExpectation({
          httpRequest: { path, method: "GET" },
          httpResponse: { statusCode: 200, body: "ok" },
          times: { unlimited: true },
        })

        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(200)
        await request(baseUrl).get(path).expect(200)
      })

      it("should return true when the expected count matches", async () => {
        expect(
          await client.verifyExpectationMatched({ path, method: "GET" }, 3),
        ).toBeTrue()
      })

      it("should return false when the expected count is exceeded", async () => {
        expect(
          await client.verifyExpectationMatched({ path, method: "GET" }, 2),
        ).toBeFalse()
      })
    })
  })
})

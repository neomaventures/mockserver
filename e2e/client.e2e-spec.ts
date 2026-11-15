import { faker } from "@faker-js/faker"
import request from "supertest"

import {
  MockserverBodyTypes,
  MockServerClient,
  type MockserverExpectation,
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

    it("should respect specific times", async () => {
      const path = `/${faker.word.noun()}`

      const expectation: MockserverExpectation = {
        httpRequest: { path, method: "GET" },
        httpResponse: { statusCode: 200, body: "once" },
        times: { remainingTimes: 1 },
      }

      await client.createExpectation(expectation)

      await request(baseUrl).get(path).expect(200)
      await request(baseUrl).get(path).expect(404)
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

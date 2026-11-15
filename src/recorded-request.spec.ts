import { recordedRequest } from "./recorded-request"

describe("recordedRequest()", () => {
  describe("Given headers whose names differ only by case", () => {
    const retrieved = {
      method: "GET",
      path: "/",
      headers: {
        "Content-Type": ["text/plain"],
        "content-type": ["text/html"],
      },
    }

    it("should merge them under the lower-cased name", () => {
      expect(recordedRequest(retrieved).headers).toEqual({
        "content-type": ["text/plain", "text/html"],
      })
    })

    it("should keep them apart by their names as sent", () => {
      expect(recordedRequest(retrieved).rawHeaders).toEqual(retrieved.headers)
    })
  })

  describe("Given a JSON body without its raw bytes", () => {
    const json = { name: "Ada" }

    it("should read its bytes from the JSON", () => {
      expect(
        recordedRequest({
          method: "POST",
          path: "/",
          body: { type: "JSON", json },
        }).body,
      ).toEqual({
        type: "JSON",
        json,
        bytes: Buffer.from(JSON.stringify(json)),
      })
    })
  })

  describe("Given a bare JSON body, as MockServer returns JSON sent with a charset", () => {
    const json = { requests: [{ updateCells: { rows: [] } }] }

    it("should read it as JSON, with its content type and bytes", () => {
      expect(
        recordedRequest({
          method: "POST",
          path: "/",
          headers: { "Content-Type": ["application/json; charset=UTF-8"] },
          body: json,
        }).body,
      ).toEqual({
        type: "JSON",
        json,
        contentType: "application/json; charset=UTF-8",
        bytes: Buffer.from(JSON.stringify(json)),
      })
    })
  })

  describe("Given a bare JSON body with a type of its own", () => {
    const json = { type: "invoice", number: "0042" }

    it("should read it as JSON, not as one of MockServer's typed bodies", () => {
      expect(
        recordedRequest({ method: "POST", path: "/", body: json }).body,
      ).toEqual({
        type: "JSON",
        json,
        bytes: Buffer.from(JSON.stringify(json)),
      })
    })
  })

  describe("Given an XML body", () => {
    const xml = "<invoice/>"

    it("should read it as a string", () => {
      expect(
        recordedRequest({
          method: "POST",
          path: "/",
          body: { type: "XML", xml, contentType: "application/xml" },
        }).body,
      ).toEqual({
        type: "STRING",
        string: xml,
        contentType: "application/xml",
        bytes: Buffer.from(xml),
      })
    })
  })

  describe("Given a body of null", () => {
    it("should read it as no body", () => {
      expect(
        recordedRequest({ method: "GET", path: "/", body: null }),
      ).not.toHaveProperty("body")
    })
  })
})

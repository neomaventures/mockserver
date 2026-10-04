import { waitForHttp } from "@neomaventures/wait-for"

/**
 * Jest `globalSetup`: block until the MockServer started by `pretest:e2e`
 * is accepting traffic.
 *
 * The container is not started here. `docker compose up -d --wait` only
 * guarantees the container is *running*, because the MockServer image ships
 * no `HEALTHCHECK` — so readiness is polled from the host instead.
 */
export default async function setup(): Promise<void> {
  const url = process.env.MOCKSERVER_URL
  if (!url) {
    throw new Error("MOCKSERVER_URL is not set — expected it from .env.e2e")
  }

  await waitForHttp(`${url}/status`, { method: "PUT" })
}

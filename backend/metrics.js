import { collectDefaultMetrics, Registry } from "@prometheus-io/client";

export function registerMetrics(fastify) {
    const registry = new Registry()

    collectDefaultMetrics({ register: registry}) //REMOVE: collects Node.js metrics like memory, CPU, etc.

    fastify.get('/metrics', async (_request, reply) => {
        return reply.type(registry.contentType).send(await registry.metrics()) //REMOVE: returns metrics for Prometheus to read.
    })
}
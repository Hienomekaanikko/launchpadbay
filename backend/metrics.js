import { collectDefaultMetrics, Counter, Histogram, Registry } from "@prometheus-io/client";

export function registerMetrics(fastify) {
    const registry = new Registry()

    collectDefaultMetrics({ register: registry}) //REMOVE: collects Node.js metrics like memory, CPU, etc.

    const requests = new Counter({
        name: 'http_requests_total',
        help: 'Completed HTTP requests, excluding metrics.',
        labelNames : ['method', 'route', 'status_code'],
        registers: [registry],
    })

    const duration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP response duration in seconds.',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [registry],
    })

    fastify.addHook('onResponse', async (request, reply) => {
        const route = request.routeOptions.url

        if (route === '/metrics') return //REMOVE: If there are other endpoints to ignore we can add here.

        const labels = {
            method: request.method,
            route: route ?? '__unmatched__',
            status_code: String(reply.statusCode),
        }

        requests.inc(labels)
        duration.observe(labels, reply.elapsedTime /1000)
    })

    fastify.get('/metrics', async (_request, reply) => {
        return reply.type(registry.contentType).send(await registry.metrics()) //REMOVE: returns metrics for Prometheus to read.
    })
}
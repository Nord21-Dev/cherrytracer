import { Cherrytracer } from 'cherrytracer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // For the playground, we instantiate a new tracer per request to allow changing keys/projects dynamically.
  // In a real app, you would likely use a singleton or a request-scoped instance from a plugin.
  const logger = new Cherrytracer({
    apiKey: body.apiKey,
    baseUrl: 'http://localhost:3000',
    projectId: body.projectId || 'server-side-playground'
  })

  // Perform a Server-Side Trace
  const span = logger.startSpan("server_handler");

  try {
    span.info("Received request from Nuxt Server", {
      headers: getRequestHeaders(event),
      node_version: process.version
    });

    // Simulate DB work
    await new Promise(r => setTimeout(r, 200));
    span.info("Database query complete");

    span.end({ status: 200 });
    return { success: true }
  } catch (e) {
    span.error("Server Error");
    span.end();
    throw e;
  }
})
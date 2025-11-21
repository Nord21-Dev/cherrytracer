import { CherryTracer } from 'cherrytracer'

// We instantiate outside the handler to simulate a singleton in a real app
// In a real app, this would be in a plugin
let logger: CherryTracer | null = null;

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Initialize singleton if needed
  if (!logger) {
    logger = new CherryTracer({
      apiKey: body.apiKey,
      baseUrl: 'http://localhost:3000',
      projectId: 'server-side-process'
    })
  }

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
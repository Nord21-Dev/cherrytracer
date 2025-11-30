import { Cherrytracer } from "./src";

const cherry = new Cherrytracer({
    apiKey: "ct_dev_123", // Assuming dev key
    projectId: "proj_123",
    baseUrl: "http://localhost:3000",
    flushInterval: 100,
});

console.log("Tracking event...");
cherry.track("user_signup", { plan: "pro", value: 20 });

setTimeout(() => {
    console.log("Done. Check dashboard.");
    process.exit(0);
}, 2000);

/**
 * Universal ID generator (Hex)
 * Avoids 'crypto' dependency issues across mixed environments
 */
export const generateId = (length = 16): string => {
  let result = "";
  const characters = "abcdef0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

/**
 * Detect Environment and gather base context
 */
export const getContext = () => {
  const context: Record<string, any> = {};

  if (typeof window !== "undefined") {
    // Browser
    context.environment = "browser";
    context.url = window.location.href;
    context.userAgent = navigator.userAgent;
  } else if (typeof process !== "undefined") {
    // Node / Bun
    context.environment = "node";
    context.nodeVersion = process.version;
    // Safely access env vars without crashing in restrictive environments
    try {
        context.hostname = process.env.HOSTNAME || "unknown";
        context.env = process.env.NODE_ENV || "development";
    } catch (e) {}
  }

  return context;
};
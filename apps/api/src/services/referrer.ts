export type ReferrerRule = {
  protocol: "http" | "https";
  hostname: string;
  allowSubdomains: boolean;
  port: string;
  pathPrefix: string;
  hasPathWildcard: boolean;
  raw: string;
};

export const DEFAULT_DEV_REFERRERS = ["http://localhost:3000/*"];

const formatRule = (rule: ReferrerRule) => {
  const path = rule.pathPrefix || "/";
  const wildcard = rule.hasPathWildcard ? "*" : "";
  const portPart = rule.port ? `:${rule.port}` : "";
  const hostPrefix = rule.allowSubdomains ? "*." : "";

  return `${rule.protocol}://${hostPrefix}${rule.hostname}${portPart}${path}${wildcard}`;
};

export const parseReferrerPattern = (pattern: string): ReferrerRule => {
  const trimmed = pattern.trim();
  if (!trimmed) throw new Error("Referrer rule cannot be empty");

  const hasWildcardHost = trimmed.includes("://*.");
  const urlForParsing = hasWildcardHost
    ? trimmed.replace("://*.", "://placeholder.")
    : trimmed;

  let url: URL;
  try {
    url = new URL(urlForParsing);
  } catch {
    throw new Error(`Invalid referrer format: ${trimmed}`);
  }

  if (url.search || url.hash) {
    throw new Error("Referrer rules cannot include query strings or hashes");
  }

  const protocol = url.protocol.replace(":", "").toLowerCase();
  if (protocol !== "http" && protocol !== "https") {
    throw new Error("Referrer must start with http:// or https://");
  }

  const hostname = url.hostname.toLowerCase();
  const baseHost = hasWildcardHost ? hostname.replace(/^placeholder\./, "") : hostname;
  if (!baseHost) throw new Error("Referrer host is missing");

  const pathname = url.pathname || "/";
  const hasPathWildcard = pathname.endsWith("*");
  const pathPrefix = hasPathWildcard ? pathname.slice(0, -1) : pathname;

  return {
    protocol,
    hostname: baseHost,
    allowSubdomains: hasWildcardHost,
    port: url.port,
    pathPrefix: pathPrefix || "/",
    hasPathWildcard,
    raw: trimmed
  };
};

export const normalizeReferrers = (referrers: string[]): string[] => {
  const normalized = new Set<string>();

  for (const ref of referrers) {
    const rule = parseReferrerPattern(ref);
    normalized.add(formatRule(rule));
  }

  return Array.from(normalized);
};

const matchesRule = (refererUrl: URL, rule: ReferrerRule) => {
  const hostname = refererUrl.hostname.toLowerCase();
  const protocol = refererUrl.protocol.replace(":", "").toLowerCase();
  const pathname = refererUrl.pathname;

  const protocolMatches = protocol === rule.protocol;

  const hostMatches = rule.allowSubdomains
    ? hostname === rule.hostname || hostname.endsWith(`.${rule.hostname}`)
    : hostname === rule.hostname;

  const portMatches = rule.port ? refererUrl.port === rule.port : true;

  const pathMatches = rule.hasPathWildcard
    ? pathname.startsWith(rule.pathPrefix)
    : pathname === rule.pathPrefix;

  return protocolMatches && hostMatches && portMatches && pathMatches;
};

export const checkReferrer = (refererHeader: string | undefined, allowedReferrers: string[]) => {
  if (!allowedReferrers || allowedReferrers.length === 0) {
    return { allowed: false, reason: "Browser key has no allowed referrers configured" };
  }

  console.log("Allowed referrers:", allowedReferrers);
  console.log("Referer header:", refererHeader);

  if (!refererHeader) {
    return { allowed: false, reason: "Missing Referer header for browser key" };
  }

  let refererUrl: URL;
  try {
    refererUrl = new URL(refererHeader);
  } catch {
    return { allowed: false, reason: "Invalid Referer header" };
  }

  let rules: ReferrerRule[] = [];
  try {
    rules = allowedReferrers.map(parseReferrerPattern);
  } catch {
    return { allowed: false, reason: "Referrer allowlist is misconfigured" };
  }

  const matched = rules.some((rule) => matchesRule(refererUrl, rule));

  if (matched) return { allowed: true };
  return { allowed: false, reason: "Referrer is not allowed for this browser key" };
};

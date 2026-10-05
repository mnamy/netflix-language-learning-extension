export function requestOrigin(headers) {
  return String((headers && (headers.origin || headers.Origin)) || "").trim();
}

export function originAllowed(origin) {
  if (!origin) {
    return false;
  }
  if (origin === "https://www.netflix.com" || origin === "https://netflix.com") {
    return true;
  }
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

export function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (originAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// Vercel/serverless adapter. Same handler as the local Node server.
import { corsHeaders, requestOrigin } from "../server/lib/cors.mjs";
import { handleTranslateRequest } from "../server/lib/handle-translate.mjs";

export default async function handler(req, res) {
  const origin = requestOrigin(req.headers);
  Object.entries(corsHeaders(origin)).forEach(function ([key, value]) {
    res.setHeader(key, value);
  });

  const result = await handleTranslateRequest({
    method: req.method,
    url: req.url || "/api/translate",
    path: "/api/translate",
    headers: req.headers,
    origin: origin,
    body: req.body || {},
  });

  res.status(result.status).json(result.body);
}

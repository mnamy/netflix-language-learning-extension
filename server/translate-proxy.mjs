// Local Node host for the same /translate handler you can deploy later.
// POST /translate { word, sentence } + Authorization: Bearer <supabase jwt>
// The sentence is used for this request only. It is not logged or stored.

import { createServer } from "node:http";
import { corsHeaders, requestOrigin } from "./lib/cors.mjs";
import { env } from "./lib/env.mjs";
import { handleTranslateRequest } from "./lib/handle-translate.mjs";

const cfg = env();

console.log("GROQ key loaded: " + (cfg.groqKey.length > 0));
console.log("Supabase auth loaded: " + Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey));
console.log("User allowlist loaded: " + Boolean(cfg.allowedUserId));
console.log("Groq model: " + cfg.groqModel);

function send(req, res, status, body) {
  const json = JSON.stringify(body);
  const origin = requestOrigin(req.headers);
  res.writeHead(
    status,
    Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(json),
      },
      corsHeaders(origin)
    )
  );
  res.end(json);
}

function readJson(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 8000) {
        reject(new Error("Request too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async function (req, res) {
  let body = {};
  if (req.method === "POST") {
    try {
      body = await readJson(req);
    } catch (err) {
      send(req, res, 400, { error: "Invalid JSON" });
      return;
    }
  }

  const result = await handleTranslateRequest({
    method: req.method,
    url: req.url,
    headers: req.headers,
    origin: requestOrigin(req.headers),
    body: body,
  });
  send(req, res, result.status, result.body);
});

server.listen(cfg.port, "127.0.0.1", function () {
  console.log("Translation API on http://127.0.0.1:" + cfg.port + " (Groq + Supabase JWT)");
});

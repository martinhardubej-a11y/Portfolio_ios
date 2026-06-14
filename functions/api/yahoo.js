// Cloudflare Pages Function – proxy na Yahoo Finance.
// Dostupná na cestě /api/yahoo (díky umístění functions/api/yahoo.js).
// Řeší CORS a lehce cachuje odpovědi.

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const p = Object.fromEntries(url.searchParams);

  const respond = (status, body) =>
    new Response(body, {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=20",
      },
    });

  const fetchUpstream = (u) =>
    fetch(u, { headers: { "User-Agent": UA }, cf: { cacheTtl: 15 } });

  try {
    if (p.endpoint === "chart" && p.symbol) {
      const range = encodeURIComponent(p.range || "1d");
      const interval = encodeURIComponent(p.interval || "5m");
      const events = p.events ? `&events=${encodeURIComponent(p.events)}` : "";
      const pre = p.prepost === "1" ? "&includePrePost=true" : "";
      const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(p.symbol)}?range=${range}&interval=${interval}${events}${pre}`;
      const res = await fetchUpstream(target);
      const body = await res.text();
      return respond(res.status, body);
    }

    if (p.endpoint === "search" && p.q) {
      const target = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(p.q)}&quotesCount=12&newsCount=0`;
      const res = await fetchUpstream(target);
      const body = await res.text();
      return respond(res.status, body);
    }

    return respond(400, JSON.stringify({ error: "Neplatný požadavek" }));
  } catch (e) {
    return respond(502, JSON.stringify({ error: String(e) }));
  }
}

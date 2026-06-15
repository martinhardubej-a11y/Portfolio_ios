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

  const fetchUpstream = (u, extraHeaders) =>
    fetch(u, { headers: { "User-Agent": UA, ...(extraHeaders||{}) }, cf: { cacheTtl: 15 } });

  // Získá cookie + crumb potřebné pro v7/quote endpoint. Výsledek se krátce cachuje.
  async function getCrumb() {
    // cookie
    const c = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA } });
    const cookie = c.headers.get("set-cookie") || "";
    // crumb
    const cr = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, "Cookie": cookie },
    });
    const crumb = await cr.text();
    return { cookie, crumb };
  }

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

    // quote – vrací pre/post cenu (preMarketPrice / postMarketPrice) jako web Yahoo.
    // Vyžaduje cookie+crumb. Používá se jen pro pre/post, ne pro hlavní ceny.
    if (p.endpoint === "quote" && p.symbol) {
      try {
        const { cookie, crumb } = await getCrumb();
        const target = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(p.symbol)}&crumb=${encodeURIComponent(crumb)}`;
        const res = await fetchUpstream(target, { Cookie: cookie });
        const body = await res.text();
        return respond(res.status, body);
      } catch (e) {
        return respond(502, JSON.stringify({ error: "quote selhalo", detail: String(e) }));
      }
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

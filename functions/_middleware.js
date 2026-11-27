// Per-route title, description, canonical, Open Graph and robots for the single-page site (WEB-M07).
// Cloudflare serves web/index.html for every route, so crawlers and link-preview bots that do not run JavaScript
// would otherwise see one title and one canonical for the whole site. Rewrites HTML responses only.
// Fail-safe: any error returns the original response, and index.html itself ships as noindex.
import { pageMeta } from "./_lib/seo.mjs";

export async function onRequest(context) {
  const res = await context.next();
  try {
    const { request, env } = context;
    if (request.method !== "GET" && request.method !== "HEAD") return res;
    if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
    const m = pageMeta(new URL(request.url), env);
    const attr = (name, value) => ({ element(e) { if (value) e.setAttribute(name, value); } });
    const rewritten = new HTMLRewriter()
      .on("title", { element(e) { if (m.title) e.setInnerContent(m.title); } })
      .on('meta[name="description"]', attr("content", m.description))
      .on('meta[name="robots"]', attr("content", m.robots))
      .on('meta[property="og:title"]', attr("content", m.title))
      .on('meta[property="og:description"]', attr("content", m.description))
      .on('meta[property="og:url"]', attr("content", m.ogUrl))
      .on('meta[property="og:image"]', attr("content", m.ogImage))
      .on('meta[property="og:image:secure_url"]', attr("content", m.ogImage))
      .on('meta[name="twitter:title"]', attr("content", m.title))
      .on('meta[name="twitter:description"]', attr("content", m.description))
      .on('meta[name="twitter:image"]', attr("content", m.ogImage))
      .on("head", { element(e) { if (m.canonical) e.append('<link rel="canonical" href="' + m.canonical + '">', { html: true }); } })
      .transform(res);
    const headers = new Headers(rewritten.headers);
    headers.delete("content-length");
    headers.delete("etag");
    if (m.xRobotsTag) headers.set("x-robots-tag", m.xRobotsTag);
    return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers });
  } catch (err) {
    return res;
  }
}

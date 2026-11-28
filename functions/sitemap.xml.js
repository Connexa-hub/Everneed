// /sitemap.xml (WEB-M07). Public marketing routes on the configured production host only; 404 everywhere else.
import { sitemapXml } from "./_lib/seo.mjs";

export function onRequestGet({ request, env }) {
  const body = sitemapXml(new URL(request.url), env);
  if (!body) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
  }
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// /robots.txt (WEB-M07). Host-aware: only the configured production host may be crawled.
import { robotsTxt } from "./_lib/seo.mjs";

export function onRequestGet({ request, env }) {
  return new Response(robotsTxt(new URL(request.url), env), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

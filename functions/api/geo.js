// Cloudflare Pages Function: GET /api/geo
// Returns where the request appears to come from (country, region, city, time zone) using Cloudflare's own request data.
// Used by shared/geo.js to pre-fill country, state, city and phone code on forms. It stores nothing, calls no outside service,
// and the person can change whatever it fills in. Never cached, because it is specific to the visitor.
export async function onRequestGet(context) {
  const cf = (context.request && context.request.cf) || {};
  const body = {
    country: cf.country || null,
    region: cf.region || null,
    regionCode: cf.regionCode || null,
    city: cf.city || null,
    timezone: cf.timezone || null,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

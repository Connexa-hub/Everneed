// Pure SEO helpers for the Pages Functions (WEB-M07). No Cloudflare APIs in this file, so Node can test it.
//
// Rule: nothing is indexable until a production origin is configured.
// Set the Pages environment variable PUBLIC_SITE_ORIGIN (for example https://www.example.com) on the production
// deployment only. Until then every host (previews included) answers robots "Disallow: /" and noindex.

export const SITE_NAME = "Everneed";
export const DEFAULT_TITLE = "Everneed — Discover Stores. Shop With Confidence.";
export const DEFAULT_DESCRIPTION =
  "Everneed connects shoppers with independent stores. Create one account, shop in the mobile app, or grow your business as a seller.";

// Public marketing routes. Only these can ever be indexed, and only on the configured production host.
export const PUBLIC_PAGES = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, priority: "1.0" },
  "/sell": {
    title: "Sell on Everneed — Open Your Store",
    description: "Apply once, get reviewed, then manage products, orders and earnings from your Everneed seller portal.",
    priority: "0.8",
  },
  "/pricing": {
    title: "Plans and Pricing — Everneed",
    description: "See Everneed seller plans: a store plan plus commission on each sale. Prices are managed by the Everneed team.",
    priority: "0.8",
  },
  "/how-it-works": {
    title: "How Everneed Works — Shop and Sell",
    description: "How shopping and selling work on Everneed: shoppers use the mobile app, sellers run their store from the web portal.",
    priority: "0.7",
  },
  "/shop": {
    title: "Shop in the Everneed App",
    description: "Shopping on Everneed happens in the mobile app. See when official download options are published.",
    priority: "0.7",
  },
  "/help": {
    title: "Help Centre — Everneed",
    description: "Answers about reviews, payouts, costs and getting started on Everneed.",
    priority: "0.5",
  },
  "/about": {
    title: "About Everneed",
    description:
      "Everneed is a marketplace that treats small sellers like real businesses, with their own store, a fair ledger and a delivery process shoppers can trust.",
    priority: "0.5",
  },
  "/early-access": {
    title: "Get Early Access — Everneed",
    description: "Join the Everneed early-access list and get an email when your country opens.",
    priority: "0.6",
  },
};

// Signed-in, account and tool routes. Never indexed, never listed in the sitemap, disallowed in robots.txt.
export const PRIVATE_PREFIXES = ["/sign-in", "/create-account", "/account", "/portal", "/admin", "/inbox", "/appearance", "/api"];

/** "/pricing/" -> "/pricing", "" -> "/", "//x" -> "/x". */
export function normalizePath(pathname) {
  let p = "/" + String(pathname || "").replace(/^\/+/, "");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

/** The configured production origin, or null. Only a bare https origin is accepted (no path, query or credentials). */
export function productionOrigin(env) {
  const raw = env && env.PUBLIC_SITE_ORIGIN;
  if (!raw || typeof raw !== "string") return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch (e) {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== "/")) return null;
  return u.origin;
}

export function isProductionHost(url, env) {
  const origin = productionOrigin(env);
  return !!origin && new URL(origin).host === url.host;
}

/** Everything the middleware needs to rewrite one HTML response. */
export function pageMeta(url, env) {
  const path = normalizePath(url.pathname);
  const page = Object.prototype.hasOwnProperty.call(PUBLIC_PAGES, path) ? PUBLIC_PAGES[path] : null;
  const production = isProductionHost(url, env);
  const indexable = production && !!page;
  const base = production ? productionOrigin(env) : url.origin;
  return {
    path,
    indexable,
    title: page ? page.title : null,
    description: page ? page.description : null,
    robots: indexable ? "index,follow" : "noindex,nofollow",
    xRobotsTag: indexable ? null : "noindex, nofollow",
    canonical: indexable ? base + (path === "/" ? "/" : path) : null,
    ogUrl: base + (path === "/" ? "/" : path),
    ogImage: base + "/og-image.png",
  };
}

export function robotsTxt(url, env) {
  const origin = isProductionHost(url, env) ? productionOrigin(env) : null;
  if (!origin) return "User-agent: *\nDisallow: /\n";
  const lines = ["User-agent: *", "Allow: /"];
  for (const p of PRIVATE_PREFIXES) lines.push("Disallow: " + p);
  lines.push("", "Sitemap: " + origin + "/sitemap.xml", "");
  return lines.join("\n");
}

function xml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Sitemap XML for the production host, or null when no production origin applies to this request. */
export function sitemapXml(url, env) {
  const origin = isProductionHost(url, env) ? productionOrigin(env) : null;
  if (!origin) return null;
  const rows = Object.keys(PUBLIC_PAGES).map(
    (p) => "  <url><loc>" + xml(origin + (p === "/" ? "/" : p)) + "</loc><priority>" + PUBLIC_PAGES[p].priority + "</priority></url>"
  );
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows.join("\n") + "\n</urlset>\n";
}

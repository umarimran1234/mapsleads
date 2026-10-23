import { lookup } from "node:dns/promises";
import net from "node:net";
import { cleanEmails } from "./leads";

const UA = "Mozilla/5.0 (compatible; google-maps-scraper-kit-app/0.1)";
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAILTO_RE = /mailto:([^"'>\s?]+)/gi;
const HREF_RE = /<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

export type FoundEmail = { email: string; source: string };
export type Socials = { instagram: string; facebook: string; linkedin: string };
export type SiteResult = { url: string; emails: FoundEmail[]; socials: Socials; pagesChecked: number; error?: string };

const NO_SOCIALS: Socials = { instagram: "", facebook: "", linkedin: "" };

// Same patterns and skip list as the --socials pass in scripts/scrape.py.
const SOCIAL_RE: Record<keyof Socials, RegExp> = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/gi,
  facebook: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/([A-Za-z0-9_.-]+)/gi,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/([A-Za-z0-9_.%-]+)/gi,
};
// Share buttons and site-wide pages, not the business's own profile.
const SKIP_HANDLE = new Set(["", "home", "pages", "people", "help", "about", "policies", "policy", "legal", "tos", "privacy",
  "settings", "sharer", "tr", "profile.php", "plugins", "dialog", "intent", "login", "share.php", "permalink.php", "p", "reel",
  "reels", "explore", "stories", "tv", "watch", "events", "groups", "marketplace", "gaming", "photo", "hashtag", "search"]);

/** First real Instagram / Facebook / LinkedIn profile link in the page. Plain regex, no LLM. */
export function findSocials(html: string): Socials {
  const out = { ...NO_SOCIALS };
  for (const plat of Object.keys(SOCIAL_RE) as (keyof Socials)[]) {
    for (const m of html.matchAll(SOCIAL_RE[plat])) {
      const handle = m[1].toLowerCase();
      if (SKIP_HANDLE.has(handle)) continue;
      if (plat === "facebook" && (/^\d+$/.test(handle) || handle.length < 3)) continue; // junk like /2008
      out[plat] = m[0].replace(/["'/\\]+$/, "").replace(/\\/g, "");
      break;
    }
  }
  return out;
}

/** Accepts "example.com", "www.example.com/path" or a full URL. Returns null if it is not a usable site. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `http://${t}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch { return null; }
}

const hostOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

/** This server fetches whatever it is told to, so refuse anything that resolves to the local machine or network. */
async function assertPublic(url: string) {
  const host = new URL(url).hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private address");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Private address");
}

async function fetchHtml(url: string, timeoutMs = 8000, cap = 400_000): Promise<string> {
  await assertPublic(url);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|text|xml/i.test(type)) throw new Error("Not a web page");
  // Read at most `cap` bytes: some sites serve enormous pages.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); size += value.length;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** decodeURIComponent throws on a stray "%" in a malformed mailto; keep the raw text then. */
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

function deobfuscate(html: string) {
  return html
    .replace(/&#0*64;|&#x0*40;|&commat;/gi, "@")
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, ".");
}

/** Emails from mailto: links and plain text, junk dropped, the site's own domain first. */
export function extractEmails(html: string, siteHost: string): string[] {
  const text = deobfuscate(html);
  // mailto: links count wherever they are. Plain-text matches come only from visible markup: scripts,
  // styles and comments carry font/theme credits ("designer@foundry.com") that are not the business's.
  const visible = text.replace(/<(script|style)[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, " ");
  const raw = [...text.matchAll(MAILTO_RE)].map((m) => safeDecode(m[1]))
    .concat(visible.match(EMAIL_RE) ?? []);
  const found = cleanEmails(raw.join(",")).split(", ").filter(Boolean);
  const own = (e: string) => e.endsWith("@" + siteHost) || e.endsWith("." + siteHost);
  return found.sort((a, b) => Number(!own(a)) - Number(!own(b)));
}

/** Up to 3 same-site contact/about URLs: links found on the page first, then common fallbacks. */
export function contactLinks(html: string, baseUrl: string): string[] {
  const host = hostOf(baseUrl);
  const out: string[] = [];
  for (const m of html.matchAll(HREF_RE)) {
    if (!/contact|about/i.test(`${m[1]} ${m[2]}`)) continue;
    try {
      const u = new URL(m[1].trim(), baseUrl);
      u.hash = "";
      if (/^https?:$/.test(u.protocol) && hostOf(u.toString()) === host && !out.includes(u.toString())) out.push(u.toString());
    } catch { /* bad href */ }
  }
  for (const p of ["/contact", "/contact-us", "/about", "/about-us"]) {
    const u = new URL(p, baseUrl).toString();
    if (out.length < 3 && !out.includes(u)) out.push(u);
  }
  return out.slice(0, 3);
}

/**
 * Homepage first; if it has no email, up to 3 contact/about pages. Social profile links come from the same
 * pages (usually the footer of the homepage), so they cost no extra requests. Never throws.
 */
export async function findEmails(rawUrl: string): Promise<SiteResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { url: rawUrl, emails: [], socials: { ...NO_SOCIALS }, pagesChecked: 0, error: "Not a valid website" };
  const host = hostOf(url);
  let pagesChecked = 0;
  let socials = { ...NO_SOCIALS };
  const addSocials = (html: string) => {
    const s = findSocials(html);
    socials = { instagram: socials.instagram || s.instagram, facebook: socials.facebook || s.facebook, linkedin: socials.linkedin || s.linkedin };
  };
  try {
    let base = url, home: string;
    try {
      home = await fetchHtml(base);
    } catch (e) {
      // Some sites only answer on www.: retry once with it before giving up.
      const u = new URL(url);
      if (u.hostname.startsWith("www.") || net.isIP(u.hostname)) throw e;
      u.hostname = `www.${u.hostname}`;
      base = u.toString();
      home = await fetchHtml(base);
    }
    pagesChecked = 1;
    addSocials(home);
    let found = extractEmails(home, host).map((email) => ({ email, source: base }));
    if (!found.length) {
      for (const page of contactLinks(home, base)) {
        try {
          const html = await fetchHtml(page);
          pagesChecked++;
          addSocials(html);
          found = extractEmails(html, host).map((email) => ({ email, source: page }));
          if (found.length) break;
        } catch { /* page missing or blocked: try the next one */ }
      }
    }
    return { url, emails: found.slice(0, 5), socials, pagesChecked };
  } catch (e) {
    return { url, emails: [], socials, pagesChecked, error: (e as Error).message || "Could not load site" };
  }
}

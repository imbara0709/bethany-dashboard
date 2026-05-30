export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getFaviconUrl(url: string, size = 32): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const first = Array.from(trimmed)[0];
  return first.toUpperCase();
}

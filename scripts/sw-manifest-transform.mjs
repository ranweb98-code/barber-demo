/**
 * Serwist on Windows embeds backslashes in public asset URLs (e.g. /fonts\file.woff).
 * Those 404 during install and block service worker activation on iOS.
 * API routes should never be precached — they slow first install and can stale.
 */
export async function swManifestTransform(manifestEntries) {
  const manifest = manifestEntries
    .map((entry) => ({
      ...entry,
      url: entry.url.replace(/\\/g, "/").replace(/\/+/g, "/"),
    }))
    .filter((entry) => {
      const { url } = entry;
      if (url.startsWith("/api/")) return false;
      if (url.includes("hero.jpg")) return false;
      return true;
    });

  return { manifest, warnings: [] };
}

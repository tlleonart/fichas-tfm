import type { MetadataRoute } from "next";

/**
 * La aplicación es privada y ahora la ven también los correctores del TFM:
 * que ningún buscador la indexe. Va junto con `robots: { index: false }` del
 * `metadata` del layout.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

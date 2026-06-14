import { defineRouting } from "next-intl/routing";

/**
 * next-intl routing config.
 * Defines supported locales and the default.
 * Used by both middleware and navigation helpers (Link, useRouter, etc.)
 */
export const routing = defineRouting({
  locales: ["en", "si", "ta"],
  defaultLocale: "en",
  // Don't prefix the default locale in URLs (e.g. /branch vs /en/branch)
  localePrefix: "as-needed",
});

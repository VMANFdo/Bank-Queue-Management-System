import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * next-intl server config.
 * Loads the correct message file based on the resolved locale.
 * The `next.config.ts` plugin points at this file.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Validate that the incoming locale is supported; fall back to default
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "en" | "si" | "ta")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (
      await import(`./messages/${locale}.json`)
    ).default,
  };
});

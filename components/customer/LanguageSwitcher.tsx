"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useState } from "react";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const switchLanguage = (newLocale: "en" | "si" | "ta") => {
    if (newLocale === locale) return;
    localStorage.setItem("bqms_preferred_locale", newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  if (!mounted) return null;

  return (
    <div className="flex bg-zinc-800 rounded-full p-1 border border-zinc-700">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLanguage(code)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
            locale === code
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

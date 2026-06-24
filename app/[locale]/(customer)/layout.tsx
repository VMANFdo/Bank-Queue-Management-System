import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/customer/LanguageSwitcher";
import { Building2 } from "lucide-react";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("common");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600/20 p-2 rounded-xl">
              <Building2 className="w-6 h-6 text-emerald-500" />
            </div>
            <span className="font-bold text-xl tracking-tight">{t("appName")}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 lg:p-8">
        {children}
      </main>

      <footer className="border-t border-zinc-800 mt-auto py-8 text-center text-zinc-500 text-sm">
        <p>BQMS Queue Management System &copy; {new Date().getFullYear()}</p>
        <p className="mt-2 text-xs opacity-75">Your NIC data is used only for verification purposes.</p>
      </footer>
    </div>
  );
}

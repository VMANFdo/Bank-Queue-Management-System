"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Landmark, ArrowRight, Activity, Search } from "lucide-react";
import { useRouter } from "@/i18n/routing";

type BranchMetric = {
  id: string;
  name: string;
  bankCode: string;
  isActive: boolean;
};

type BankData = {
  code: string;
  type: "state" | "private";
  colorClass: string;
  bgGradient: string;
};

const BANK_SEARCH_TERMS: Record<string, string[]> = {
  BOC: ["Bank of Ceylon", "ලංකා බැංකුව", "இலங்கை வங்கி"],
  PEOPLES: ["People's Bank", "මහජන බැංකුව", "மக்கள் வங்கி"],
  COMMERCIAL: ["Commercial Bank of Ceylon", "කොමර්ෂල් බැංකුව", "கொமர்ஷல் வங்கி"],
  HNB: ["Hatton National Bank", "හැටන් නැෂනල් බැංකුව", "ஹட்டன் நேஷனல் வங்கி"],
  SAMPATH: ["Sampath Bank", "සම්පත් බැංකුව", "சம்பத் வங்கி"],
  SEYLAN: ["Seylan Bank", "සෙලාන් බැංකුව", "செய்லான் வங்கி"],
};

const BANKS: BankData[] = [
  {
    code: "BOC",
    type: "state",
    colorClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    bgGradient: "from-amber-600/20 to-teal-500/10",
  },
  {
    code: "PEOPLES",
    type: "state",
    colorClass: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    bgGradient: "from-yellow-600/20 to-amber-500/10",
  },
  {
    code: "COMMERCIAL",
    type: "private",
    colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    bgGradient: "from-blue-600/20 to-cyan-500/10",
  },
  {
    code: "HNB",
    type: "private",
    colorClass: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
    bgGradient: "from-indigo-600/20 to-blue-500/10",
  },
  {
    code: "SAMPATH",
    type: "private",
    colorClass: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    bgGradient: "from-orange-600/20 to-zinc-500/10",
  },
  {
    code: "SEYLAN",
    type: "private",
    colorClass: "text-red-400 border-red-500/30 bg-red-500/10",
    bgGradient: "from-red-600/20 to-zinc-500/10",
  },
];

export default function SelectBankPage() {
  const t = useTranslations("branch");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/customer/branches")
      .then((res) => res.json())
      .then((data: BranchMetric[]) => {
        const counts: Record<string, number> = {};
        data.forEach((branch) => {
          if (branch.isActive) {
            const code = branch.bankCode.toUpperCase();
            counts[code] = (counts[code] || 0) + 1;
          }
        });
        setBranchCounts(counts);
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load branches for bank counts", err);
        setLoading(false);
      });
  }, []);

  const handleBankSelect = (bankCode: string) => {
    if (branchCounts[bankCode] > 0) {
      router.push(`/branch?bank=${bankCode}`);
    }
  };

  const filteredBanks = BANKS.filter((bank) => {
    const query = searchQuery.toLowerCase();
    const terms = BANK_SEARCH_TERMS[bank.code] || [];
    return terms.some((term) => term.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 pt-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t("selectBank")}
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          {t("bankPageSubtitle")}
        </p>
      </div>

      {/* Search filter */}
      <div className="relative max-w-md mx-auto">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-500" />
        </div>
        <input
          type="text"
          placeholder={t("searchBank")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto">
          {filteredBanks.map((bank) => {
            const count = branchCounts[bank.code] || 0;
            const hasBranches = count > 0;

            return (
              <button
                key={bank.code}
                disabled={!hasBranches}
                onClick={() => handleBankSelect(bank.code)}
                className={`relative group text-left rounded-3xl border p-6 flex flex-col justify-between min-h-[190px] overflow-hidden transition-all duration-300 ${
                  hasBranches
                    ? "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900 cursor-pointer hover:translate-y-[-2px]"
                    : "bg-zinc-950/40 border-zinc-900 opacity-50 cursor-not-allowed"
                }`}
              >
                {/* Background glowing gradient */}
                {hasBranches && (
                  <div
                    className={`absolute inset-0 bg-gradient-to-tr ${bank.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                  />
                )}

                <div className="flex justify-between items-start z-10 w-full">
                  <div className={`p-3 rounded-2xl ${bank.colorClass} border shrink-0`}>
                    <Landmark className="w-6 h-6" />
                  </div>

                  {hasBranches ? (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                      <Activity className="w-3.5 h-3.5 animate-pulse" />
                      <span>
                        {t("activeBranches", { count })}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-full text-xs font-medium">
                      {tCommon("offline")}
                    </div>
                  )}
                </div>

                <div className="mt-6 z-10">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                    {t("bankTypes." + bank.type)}
                  </span>
                  <h3 className="text-lg font-bold text-zinc-100 leading-snug mt-1 group-hover:text-white transition-colors">
                    {t("bankNames." + bank.code)}
                  </h3>
                </div>

                {hasBranches && (
                  <div className="absolute bottom-4 right-4 text-emerald-500 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Search, Clock, Users, Navigation, ArrowLeft, Landmark } from "lucide-react";
import { Link } from "@/i18n/routing";
import { formatWaitTime } from "@/lib/utils";

type BranchMetric = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  isActive: boolean;
  waitingCount: number;
  waitTimeMinutes: number;
  crowdLevel: "low" | "moderate" | "busy";
  openCounters: number;
};

const VALID_BANK_CODES = ["BOC", "PEOPLES", "COMMERCIAL", "HNB", "SAMPATH", "SEYLAN"];

function BranchFinderContent() {
  const t = useTranslations("branch");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const bankCode = searchParams.get("bank")?.toUpperCase();

  const [branches, setBranches] = useState<BranchMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bankCode) return;
    setLoading(true);
    fetch(`/api/customer/branches?bank=${bankCode}`)
      .then((res) => res.json())
      .then((data) => {
        setBranches(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [bankCode]);

  if (!bankCode || !VALID_BANK_CODES.includes(bankCode)) {
    return (
      <div className="text-center py-16 space-y-6 max-w-md mx-auto">
        <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-600 inline-flex">
          <Landmark className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-200">{t("bankNotSelected")}</h2>
        <p className="text-zinc-500">
          {t("bankNotSelectedDesc")}
        </p>
        <Link
          href="/select-bank"
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-colors min-h-[48px] w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("selectBankRedirect")}
        </Link>
      </div>
    );
  }

  const bankName = t("bankNames." + bankCode);
  const filteredBranches = branches.filter((b) =>
    b.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link
          href="/select-bank"
          className="text-zinc-400 hover:text-white p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 transition-colors flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">
            {bankName}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-0.5">
            {t("findBranch")}
          </h1>
        </div>
      </div>

      <div className="relative max-w-xl mx-auto">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-500" />
        </div>
        <input
          type="text"
          placeholder={t("searchByCity")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
        />
        <button 
          className="absolute inset-y-2 right-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl flex items-center gap-2 transition-colors"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(() => {
                // sort logic
              });
            }
          }}
        >
          <Navigation className="w-4 h-4" />
          <span className="hidden sm:inline">{t("nearMe")}</span>
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200 pl-1">{t("allBranches")}</h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {t("noBranchesForBank", { bankName, query: searchQuery })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredBranches.map((branch) => (
              <div
                key={branch.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{branch.name}</h3>
                    <div className="flex items-center gap-1.5 text-zinc-400 mt-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="text-sm line-clamp-1">{branch.address}</span>
                    </div>
                  </div>
                  
                  <div className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-medium shrink-0 ${
                    branch.crowdLevel === 'low' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    branch.crowdLevel === 'moderate' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    <Users className="w-3 h-3" />
                    <span>{t(`crowdLevel.${branch.crowdLevel}`)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 rounded-xl p-3 mb-5">
                  <div>
                    <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider font-semibold">{t("waitTime")}</div>
                    <div className="flex items-center gap-1.5 text-zinc-200">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{formatWaitTime(branch.waitTimeMinutes)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider font-semibold">{t("inLine")}</div>
                    <div className="text-zinc-200 font-medium">{branch.waitingCount} people</div>
                  </div>
                </div>

                <div className="mt-auto pt-2 grid grid-cols-2 gap-3">
                  <Link
                    href={`/branch/${branch.id}/book`}
                    className="flex items-center justify-center py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors min-h-[48px]"
                  >
                    {t("bookLater")}
                  </Link>
                  <Link
                    href={`/branch/${branch.id}`}
                    className="flex items-center justify-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors min-h-[48px]"
                  >
                    {t("selectServices")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BranchFinderPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    }>
      <BranchFinderContent />
    </Suspense>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { MapPin, Search, Clock, Users, Navigation } from "lucide-react";
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

export default function BranchFinderPage() {
  const t = useTranslations("branch");
  const [branches, setBranches] = useState<BranchMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customer/branches")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to load branches");
        }
        setBranches(data);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredBranches = branches.filter((b) =>
    b.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 pt-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("findBranch")}</h1>
        <p className="text-zinc-400 text-lg">
          Find your nearest branch to join the queue or book an appointment.
        </p>
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
            // Geolocation could be triggered here
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(() => {
                // Future: sort by distance
              });
            }
          }}
        >
          <Navigation className="w-4 h-4" />
          <span className="hidden sm:inline">Near Me</span>
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
            No branches found matching &quot;{searchQuery}&quot;
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
                    <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider font-semibold">In Line</div>
                    <div className="text-zinc-200 font-medium">{branch.waitingCount} people</div>
                  </div>
                </div>

                <div className="mt-auto pt-2 grid grid-cols-2 gap-3">
                  <Link
                    href={`/branch/${branch.id}/book`}
                    className="flex items-center justify-center py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors min-h-[48px]"
                  >
                    Book Later
                  </Link>
                  <Link
                    href={`/branch/${branch.id}`}
                    className="flex items-center justify-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors min-h-[48px]"
                  >
                    Select Services
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

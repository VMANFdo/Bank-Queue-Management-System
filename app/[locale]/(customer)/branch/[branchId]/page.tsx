"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, use } from "react";
import { MapPin, Phone, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { ServiceCategoryCard } from "@/components/customer/ServiceCategoryCard";

type ServiceMetric = {
  id: string;
  name: string;
  nameSi: string;
  nameTa: string;
  icon: string;
  category: string;
  waitingCount: number;
  waitTimeMinutes: number;
};

type BranchDetails = {
  id: string;
  name: string;
  address: string;
  phone: string;
  bankCode: string;
  waitingCount: number;
  crowdLevel: string;
};

export default function BranchServicesPage({
  params,
}: {
  params: Promise<{ branchId: string; locale: string }>;
}) {
  const unwrappedParams = use(params);
  const { branchId } = unwrappedParams;
  const locale = useLocale();
  const t = useTranslations("branch");
  const tCommon = useTranslations("common");

  const [services, setServices] = useState<ServiceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Branch details fetched from the branches list API
  const [branchDetails, setBranchDetails] = useState<BranchDetails | null>(null);

  useEffect(() => {
    // Fetch branch info & services
    Promise.all([
      fetch(`/api/customer/branches`),
      fetch(`/api/customer/branches/${branchId}/services`)
    ])
    .then(async ([branchesRes, servicesRes]) => {
      const branches = await branchesRes.json();
      const svcs = await servicesRes.json();
      
      const currentBranch = branches.find((b: BranchDetails) => b.id === branchId);
      if (currentBranch) setBranchDetails(currentBranch);
      
      setServices(svcs);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [branchId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Back button */}
      <div>
        <Link href="/" className="text-emerald-500 hover:text-emerald-400 font-medium inline-flex items-center gap-2">
          &larr; {tCommon("back")}
        </Link>
      </div>

      {/* Branch Header */}
      {branchDetails && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-4">{branchDetails.name}</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-zinc-400">
            <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl">
              <MapPin className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-sm">{branchDetails.address}</span>
            </div>
            <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl">
              <Clock className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-sm">Open until 3:30 PM</span>
            </div>
            <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl">
              <Phone className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-sm">{branchDetails.phone || "011 2 345 678"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Service Selection */}
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">{t("selectService")}</h2>
            <p className="text-zinc-400 mt-1">What would you like to do today?</p>
          </div>
          <button className="text-emerald-500 text-sm font-medium hover:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {t("notSure")}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
             <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc) => (
              <ServiceCategoryCard
                key={svc.id}
                id={svc.id}
                name={svc.name}
                nameSi={svc.nameSi}
                nameTa={svc.nameTa}
                iconName={svc.icon}
                waitingCount={svc.waitingCount}
                waitTimeMinutes={svc.waitTimeMinutes}
                locale={locale}
                selected={selectedServiceId === svc.id}
                onClick={setSelectedServiceId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      {selectedServiceId && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 z-40 transform animate-in slide-in-from-bottom duration-300">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
            <Link
              href={`/branch/${branchId}/book?serviceId=${selectedServiceId}`}
              className="flex-1 py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-2xl font-semibold text-lg flex items-center justify-center transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              Book for Later
            </Link>
            <Link
              href={`/branch/${branchId}/join?serviceId=${selectedServiceId}`}
              className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              Join Queue Now <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

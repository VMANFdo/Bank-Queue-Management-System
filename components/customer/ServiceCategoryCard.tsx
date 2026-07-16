import { LucideIcon, Banknote, UserPlus, FileText, Globe, CreditCard, Building2, Shield, CircleHelp } from "lucide-react";
import { formatWaitTime } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Banknote,
  UserPlus,
  FileText,
  Globe,
  CreditCard,
  Building2,
  Shield,
  CircleHelp
};

interface ServiceCategoryCardProps {
  id: string;
  name: string;
  nameSi: string;
  nameTa: string;
  iconName: string;
  waitingCount: number;
  waitTimeMinutes: number;
  locale: string;
  onClick: (id: string) => void;
  selected?: boolean;
}

export function ServiceCategoryCard({
  id,
  name,
  nameSi,
  nameTa,
  iconName,
  waitingCount,
  waitTimeMinutes,
  locale,
  onClick,
  selected = false,
}: ServiceCategoryCardProps) {
  const Icon = iconMap[iconName] || CircleHelp;
  
  const displayName = locale === 'si' && nameSi ? nameSi : locale === 'ta' && nameTa ? nameTa : name;

  return (
    <button
      onClick={() => onClick(id)}
      className={`relative w-full text-left bg-zinc-900 border rounded-2xl p-5 transition-all flex flex-col min-h-[140px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
        selected ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex justify-between items-start w-full mb-auto">
        <div className={`p-3 rounded-xl inline-flex ${selected ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-300"}`}>
          <Icon className="w-6 h-6" />
        </div>
        {waitingCount > 0 && (
          <div className="flex flex-col items-end text-xs">
            <span className="text-zinc-500 font-medium">Wait Time</span>
            <span className={`font-semibold ${waitTimeMinutes > 20 ? 'text-yellow-500' : 'text-emerald-400'}`}>
              ~{formatWaitTime(waitTimeMinutes)}
            </span>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <h3 className="text-lg font-bold text-zinc-100 leading-tight">
          {displayName}
        </h3>
        {waitingCount > 0 && (
          <p className="text-sm text-zinc-500 mt-1">
            {waitingCount} people waiting
          </p>
        )}
      </div>
    </button>
  );
}

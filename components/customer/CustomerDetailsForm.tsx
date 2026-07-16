"use client";

import { useMemo } from "react";
import { isValidNic } from "@/lib/utils";

export type CustomerDetailsValue = {
  name: string;
  phone: string;
  nic: string;
  language: "en" | "si" | "ta";
};

interface CustomerDetailsFormProps {
  value: CustomerDetailsValue;
  onChange: (value: CustomerDetailsValue) => void;
  nicRequired?: boolean;
}

const languages = [
  { value: "en", label: "English" },
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
] as const;

export function CustomerDetailsForm({
  value,
  onChange,
  nicRequired = false,
}: CustomerDetailsFormProps) {
  const phoneDigits = value.phone.replace(/\D/g, "");
  const nic = value.nic.trim();

  const errors = useMemo(() => {
    return {
      name: value.name.trim().length > 0 && value.name.trim().length < 2,
      phone: phoneDigits.length > 0 && !/^0?7\d{8}$/.test(phoneDigits),
      nic: nic.length > 0 && !isValidNic(nic),
    };
  }, [nic, phoneDigits, value.name]);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-base font-medium text-zinc-200">Full name</span>
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          className="min-h-[60px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-lg text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          placeholder="Enter your full name"
          autoComplete="name"
        />
        {errors.name && <span className="mt-2 block text-sm text-red-300">Name must be at least 2 characters.</span>}
      </label>

      <label className="block">
        <span className="mb-2 block text-base font-medium text-zinc-200">Phone number</span>
        <input
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          className="min-h-[60px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-lg text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          placeholder="07X XXXXXXX"
          inputMode="tel"
          autoComplete="tel"
        />
        {errors.phone && <span className="mt-2 block text-sm text-red-300">Use a Sri Lankan mobile number, for example 0712345678.</span>}
      </label>

      <label className="block">
        <span className="mb-2 block text-base font-medium text-zinc-200">
          NIC number {nicRequired ? <span className="text-emerald-300">(required)</span> : <span className="text-zinc-500">(optional)</span>}
        </span>
        <input
          value={value.nic}
          onChange={(event) => onChange({ ...value, nic: event.target.value.toUpperCase() })}
          className="min-h-[60px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-lg text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          placeholder="985120456V or 199812000456"
          autoComplete="off"
        />
        <span className="mt-2 block text-sm text-zinc-500">Old NIC with V/X or new 12-digit NIC are accepted.</span>
        {errors.nic && <span className="mt-2 block text-sm text-red-300">Please enter a valid Sri Lankan NIC.</span>}
      </label>

      <div>
        <span className="mb-2 block text-base font-medium text-zinc-200">SMS language</span>
        <div className="grid grid-cols-3 gap-2">
          {languages.map((language) => (
            <button
              key={language.value}
              type="button"
              onClick={() => onChange({ ...value, language: language.value })}
              className={`min-h-[60px] rounded-2xl border px-3 text-base font-semibold transition ${
                value.language === language.value
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

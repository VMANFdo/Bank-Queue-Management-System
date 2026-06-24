"use client";

import { Accessibility, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type QueuePool = "standard" | "priority";

interface QueueTypeSelectorProps {
  value: QueuePool;
  onChange: (value: QueuePool) => void;
  priorityDeclarationChecked: boolean;
  onPriorityDeclarationChange: (checked: boolean) => void;
}

const options = [
  {
    value: "standard" as const,
    title: "Standard Queue",
    description: "Join the regular walk-in queue for this service.",
    icon: UserRound,
  },
  {
    value: "priority" as const,
    title: "Priority Queue",
    description: "For senior citizens, pregnant customers, and customers with disabilities.",
    icon: Accessibility,
  },
];

export function QueueTypeSelector({
  value,
  onChange,
  priorityDeclarationChecked,
  onPriorityDeclarationChange,
}: QueueTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[132px] rounded-2xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950",
                selected
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              )}
            >
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex rounded-xl p-3",
                    selected ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-300"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span
                  className={cn(
                    "h-5 w-5 rounded-full border",
                    selected ? "border-emerald-400 bg-emerald-500" : "border-zinc-600"
                  )}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">{option.title}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{option.description}</p>
            </button>
          );
        })}
      </div>

      {value === "priority" && (
        <label className="flex min-h-[64px] cursor-pointer items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-zinc-100">
          <input
            type="checkbox"
            checked={priorityDeclarationChecked}
            onChange={(event) => onPriorityDeclarationChange(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500"
          />
          <span>
            <span className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Priority declaration
            </span>
            <span className="mt-1 block text-sm leading-6 text-zinc-300">
              I confirm I qualify for priority service as a senior citizen, person with disability, or pregnant customer.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

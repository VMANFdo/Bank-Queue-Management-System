"use client";

import { useMemo } from "react";
import { CalendarDays, Check, CircleAlert, Clock3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlotItem = {
  time: string;
  label: string;
  status: "available" | "full" | "too_soon";
  remainingCapacity: number;
  reason?: string;
};

interface SlotPickerProps {
  loading: boolean;
  slots: SlotItem[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  earliestAvailable: string | null;
  onSelectEarliest: () => void;
}

export function SlotPicker({
  loading,
  slots,
  selectedSlot,
  onSelectSlot,
  earliestAvailable,
  onSelectEarliest,
}: SlotPickerProps) {
  const hasSlots = slots.length > 0;

  const availableCount = useMemo(() => slots.filter((slot) => slot.status === "available").length, [slots]);

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950/40">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : !hasSlots ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6 text-zinc-400">
          No slots are available for the selected date.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-zinc-200">Available slots</p>
            <p className="text-sm text-zinc-500">{availableCount} open</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot) => {
              const selected = selectedSlot === slot.time;
              const disabled = slot.status !== "available";

              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectSlot(slot.time)}
                  className={cn(
                    "min-h-[96px] rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed",
                    slot.status === "available"
                      ? selected
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="block text-lg font-bold text-zinc-100">{slot.label}</span>
                      <span className="mt-1 block text-sm text-zinc-500">
                        {slot.status === "available"
                          ? `${slot.remainingCapacity} spaces left`
                          : slot.status === "full"
                          ? "Full"
                          : "Too soon"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full",
                        slot.status === "available"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      {slot.status === "available" ? <Check className="h-4 w-4" /> : slot.status === "full" ? <CircleAlert className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </span>
                  </div>
                  {slot.reason && <p className="mt-3 text-sm text-zinc-500">{slot.reason}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {earliestAvailable && (
        <button
          type="button"
          onClick={onSelectEarliest}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/15"
        >
          <CalendarDays className="h-4 w-4" />
          Earliest available
        </button>
      )}
    </div>
  );
}

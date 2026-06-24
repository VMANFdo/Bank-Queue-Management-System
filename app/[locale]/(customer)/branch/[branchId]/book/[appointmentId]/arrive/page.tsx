"use client";

import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Search } from "lucide-react";
import { Link } from "@/i18n/routing";

type AppointmentSummary = {
  id: string;
  branchId: string;
  serviceId: string;
  bookingCode: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  customerName: string;
  customerPhone: string;
  nic: string;
  arrivalConfirmedAt: string | null;
  branchName: string;
  branchAddress: string;
  serviceName: string;
};

type CheckInResult = {
  ticket: {
    id: string;
    tokenNumber: string;
    status: string;
  };
};

export default function ArrivalConfirmPage({
  params,
}: {
  params: Promise<{ branchId: string; appointmentId: string; locale: string }>;
}) {
  const { branchId, appointmentId } = use(params);
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<"code" | "nic">("code");
  const [bookingCode, setBookingCode] = useState("");
  const [nic, setNic] = useState("");

  useEffect(() => {
    fetch(`/api/customer/appointments/${appointmentId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "We could not load this appointment.");
        setAppointment(data);
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "We could not load this appointment.");
      })
      .finally(() => setLoading(false));
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment) return;

    const tick = () => {
      const unlockTime = new Date(appointment.windowStart).getTime() - 10 * 60 * 1000;
      setCountdownMs(Math.max(0, unlockTime - Date.now()));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [appointment]);

  const unlockTimeReached = countdownMs === 0;
  const countdownLabel = useMemo(() => {
    const totalSeconds = Math.ceil(countdownMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }, [countdownMs]);

  const submitCheckIn = async (targetAppointmentId: string) => {
    setCheckingIn(true);
    setError(null);

    try {
      const response = await fetch("/api/queue/check-in-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: targetAppointmentId,
          method: "app",
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Check-in failed.");
      setCheckedIn(payload);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  };

  const lookupAppointment = async () => {
    setCheckingIn(true);
    setError(null);

    try {
      const params = new URLSearchParams({ branchId });
      if (manualMode === "code") {
        params.set("bookingCode", bookingCode.trim());
      } else {
        params.set("nic", nic.trim().toUpperCase());
      }

      const response = await fetch(`/api/customer/appointments/lookup?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Appointment not found.");

      setAppointment(payload);
      setManualOpen(false);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Appointment not found.");
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (checkedIn) {
    return (
      <div className="space-y-6 pb-20">
        <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">Checked in</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-zinc-50">{checkedIn.ticket.tokenNumber}</h1>
          <p className="mt-3 text-zinc-300">Your arrival has been recorded. You can track the token now.</p>
        </section>

        <Link
          href={`/track/${checkedIn.ticket.id}`}
          className="flex min-h-[60px] items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500"
        >
          Track token
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <Link href={`/branch/${branchId}/book`} className="inline-flex min-h-[44px] items-center gap-2 text-emerald-400 hover:text-emerald-300">
        <ArrowLeft className="h-4 w-4" />
        Back to booking
      </Link>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Arrival check-in</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{appointment?.branchName ?? "Appointment"}</h1>
        {appointment && <p className="text-lg text-zinc-400">{appointment.serviceName} at {appointment.branchAddress}</p>}
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}

      {appointment && (
        <section className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <span className="block text-sm text-zinc-500">Booking code</span>
              <span className="mt-1 block text-2xl font-black text-zinc-50">{appointment.bookingCode}</span>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <span className="block text-sm text-zinc-500">Window</span>
              <span className="mt-1 block text-lg font-semibold text-zinc-100">
                {new Date(appointment.windowStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {new Date(appointment.windowEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <Clock3 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-zinc-500">I Have Arrived</p>
                <p className="text-lg font-semibold text-zinc-100">
                  {unlockTimeReached ? "You can check in now." : `Available in ${countdownLabel}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!unlockTimeReached || checkingIn}
              onClick={() => submitCheckIn(appointment.id)}
              className="mt-5 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {checkingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              I Have Arrived
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
        <button
          type="button"
          onClick={() => setManualOpen((current) => !current)}
          className="flex min-h-[60px] w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-lg font-semibold text-zinc-100">Did not get a notification?</span>
            <span className="mt-1 block text-sm text-zinc-500">Use booking code or NIC to find your appointment.</span>
          </span>
          <Search className="h-5 w-5 text-zinc-400" />
        </button>

        {manualOpen && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setManualMode("code")}
                className={`min-h-[56px] rounded-2xl border px-4 text-base font-semibold ${
                  manualMode === "code"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }`}
              >
                Enter booking code
              </button>
              <button
                type="button"
                onClick={() => setManualMode("nic")}
                className={`min-h-[56px] rounded-2xl border px-4 text-base font-semibold ${
                  manualMode === "nic"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }`}
              >
                Enter NIC number
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-base font-medium text-zinc-200">
                {manualMode === "code" ? "Booking code" : "NIC number"}
              </span>
              <input
                value={manualMode === "code" ? bookingCode : nic}
                onChange={(event) => (manualMode === "code" ? setBookingCode(event.target.value.toUpperCase()) : setNic(event.target.value.toUpperCase()))}
                className="min-h-[60px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-lg text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                placeholder={manualMode === "code" ? "BK9X3A" : "199812000456"}
              />
            </label>

            <button
              type="button"
              disabled={checkingIn}
              onClick={lookupAppointment}
              className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-6 text-lg font-semibold text-zinc-200 transition hover:border-zinc-700 disabled:cursor-not-allowed"
            >
              {checkingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Find appointment
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

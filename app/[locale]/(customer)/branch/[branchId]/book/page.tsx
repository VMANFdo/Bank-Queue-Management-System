"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarRange, CheckCircle2, Download, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { CustomerDetailsForm, type CustomerDetailsValue } from "@/components/customer/CustomerDetailsForm";
import { SlotPicker, type SlotItem } from "@/components/customer/SlotPicker";
import { formatWaitTime } from "@/lib/utils";

type BranchMetric = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

type ServiceMetric = {
  id: string;
  name: string;
  nameSi: string;
  nameTa: string;
  icon: string;
  category: string;
  nicRequired: boolean;
  waitTimeMinutes: number;
};

type BookingResult = {
  success: boolean;
  appointment: {
    id: string;
    bookingCode: string;
    windowStart: string;
    windowEnd: string;
    status: string;
  };
  bookingCode: string;
  windowStart: string;
  windowEnd: string;
};

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBusinessDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(getLocalDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildIcsFile({
  title,
  start,
  end,
  description,
}: {
  title: string;
  start: string;
  end: string;
  description: string;
}) {
  const toIcsDate = (value: string) =>
    new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BQMS//Booking//EN
BEGIN:VEVENT
UID:${crypto.randomUUID()}
DTSTAMP:${toIcsDate(new Date().toISOString())}
DTSTART:${toIcsDate(start)}
DTEND:${toIcsDate(end)}
SUMMARY:${title}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;
}

export default function BookAppointmentPage({
  params,
}: {
  params: Promise<{ branchId: string; locale: string }>;
}) {
  const { branchId } = use(params);
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get("serviceId");

  const [branch, setBranch] = useState<BranchMetric | null>(null);
  const [services, setServices] = useState<ServiceMetric[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => getBusinessDates(7)[0] ?? null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotItems, setSlotItems] = useState<SlotItem[]>([]);
  const [earliestAvailable, setEarliestAvailable] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerDetailsValue>({
    name: "",
    phone: "",
    nic: "",
    language: locale === "si" || locale === "ta" ? locale : "en",
  });
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<BookingResult | null>(null);

  const dates = useMemo(() => getBusinessDates(7), []);
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const nicRequired = Boolean(selectedService?.nicRequired);
  const phoneDigits = details.phone.replace(/\D/g, "");

  const detailsValid = useMemo(() => {
    const validName = details.name.trim().length >= 2;
    const validPhone = /^0?7\d{8}$/.test(phoneDigits);
    const validNic = details.nic.trim().length > 0 ? /^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(details.nic.trim()) : !nicRequired;
    return validName && validPhone && validNic;
  }, [details.name, details.nic, nicRequired, phoneDigits]);

  useEffect(() => {
    Promise.all([fetch("/api/customer/branches"), fetch(`/api/customer/branches/${branchId}/services`)])
      .then(async ([branchesResponse, servicesResponse]) => {
        const branches = await branchesResponse.json();
        const serviceList = await servicesResponse.json();
        setBranch(branches.find((item: BranchMetric) => item.id === branchId) ?? null);
        setServices(serviceList);
        setSelectedServiceId((current) => current ?? serviceList[0]?.id ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError("We could not load booking data right now.");
        setLoading(false);
      });
  }, [branchId]);

  useEffect(() => {
    if (!selectedServiceId || !selectedDate) return;

    fetch(`/api/customer/branches/${branchId}/slots?serviceId=${selectedServiceId}&date=${selectedDate}`)
      .then((response) => response.json())
      .then((data) => {
        setSlotItems(data.slots ?? []);
        setEarliestAvailable(data.earliestAvailable ?? null);
      })
      .catch(() => setError("We could not load the time slots."))
      .finally(() => setSlotsLoading(false));
  }, [branchId, selectedDate, selectedServiceId]);

  const selectEarliest = () => {
    if (!earliestAvailable) return;
    setSelectedSlot(earliestAvailable);
  };

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlotItems([]);
    setEarliestAvailable(null);
    setSlotsLoading(true);
  };

  const chooseService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSelectedSlot(null);
    setSlotItems([]);
    setEarliestAvailable(null);
    setSlotsLoading(true);
  };

  const submitBooking = async () => {
    if (!selectedServiceId || !selectedSlot || !detailsValid) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/customer/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceId: selectedServiceId,
          slotTime: selectedSlot,
          customerDetails: {
            name: details.name.trim(),
            phone: phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`,
            nic: details.nic.trim() || "",
          },
          language: details.language,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Appointment could not be booked.");

      setResult(payload);
      setStep(3);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Appointment could not be booked.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadIcs = () => {
    if (!result?.appointment) return;

    const blob = new Blob(
      [
        buildIcsFile({
          title: `BQMS Appointment ${result.appointment.bookingCode}`,
          start: result.appointment.windowStart,
          end: result.appointment.windowEnd,
          description: `Branch: ${branch?.name ?? "BQMS branch"}`,
        }),
      ],
      { type: "text/calendar;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.appointment.bookingCode}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <Link href={`/branch/${branchId}`} className="inline-flex min-h-[44px] items-center gap-2 text-emerald-400 hover:text-emerald-300">
        <ArrowLeft className="h-4 w-4" />
        Back to services
      </Link>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Book appointment</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{branch?.name ?? "Branch"}</h1>
        {selectedService && <p className="text-lg text-zinc-400">{selectedService.name} usually takes about {formatWaitTime(selectedService.waitTimeMinutes)}.</p>}
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}

      <div className="grid grid-cols-3 gap-2">
        {["Pick time", "Details", "Confirm"].map((label, index) => (
          <div
            key={label}
            className={`rounded-full px-3 py-2 text-center text-sm font-semibold ${
              step >= index + 1 ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-xl font-bold text-zinc-100">Select a service</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => chooseService(service.id)}
                  className={`min-h-[84px] rounded-2xl border px-4 py-3 text-left transition ${
                    selectedServiceId === service.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  }`}
                >
                  <span className="block text-lg font-semibold text-zinc-100">{service.name}</span>
                  <span className="mt-1 block text-sm text-zinc-400">{formatWaitTime(service.waitTimeMinutes)} estimated wait</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-xl font-bold text-zinc-100">Pick a day</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {dates.map((date) => {
                const selected = selectedDate === date;
                return (
                <button
                  key={date}
                  type="button"
                  onClick={() => chooseDate(date)}
                  className={`min-h-[72px] rounded-2xl border px-4 py-3 text-left transition ${
                    selected ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  }`}
                  >
                    <span className="block text-sm font-semibold text-zinc-400">{formatDateLabel(date)}</span>
                    <span className="mt-1 block text-xs text-zinc-500">Business day</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-xl font-bold text-zinc-100">Choose a slot</h2>
            <SlotPicker
              loading={slotsLoading}
              slots={slotItems}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              earliestAvailable={earliestAvailable}
              onSelectEarliest={selectEarliest}
            />
          </section>

          <button
            type="button"
            disabled={!selectedServiceId || !selectedSlot}
            onClick={() => setStep(2)}
            className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Continue <CheckCircle2 className="h-5 w-5" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="mb-5 text-xl font-bold text-zinc-100">Your details</h2>
            <CustomerDetailsForm value={details} onChange={setDetails} nicRequired={nicRequired} />
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[60px] rounded-2xl border border-zinc-800 bg-zinc-900 px-6 text-lg font-semibold text-zinc-200 transition hover:border-zinc-700"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!detailsValid || submitting}
              onClick={submitBooking}
              className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Confirm booking
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CalendarRange className="mx-auto h-12 w-12 text-emerald-300" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">Booking confirmed</p>
            <h2 className="mt-2 text-5xl font-black tracking-tight text-zinc-50">{result.bookingCode}</h2>
            <p className="mt-3 text-zinc-300">
              Arrival window {new Date(result.windowStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {new Date(result.windowEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
            <p className="mt-2 text-sm text-zinc-400">Please arrive before the 10-minute check-in window opens.</p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={downloadIcs}
              className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-6 text-lg font-semibold text-zinc-200 transition hover:border-zinc-700"
            >
              <Download className="h-5 w-5" />
              Add to calendar
            </button>
            <Link
              href={`/branch/${branchId}/book/${result.appointment.id}/arrive`}
              className="flex min-h-[60px] items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500"
            >
              Track appointment
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

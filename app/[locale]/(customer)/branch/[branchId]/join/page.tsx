"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Copy, Link2, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { CustomerDetailsForm, type CustomerDetailsValue } from "@/components/customer/CustomerDetailsForm";
import { QueueTypeSelector } from "@/components/customer/QueueTypeSelector";
import { ServiceCategoryCard } from "@/components/customer/ServiceCategoryCard";
import { formatWaitTime, isValidNic } from "@/lib/utils";

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
  waitingCount: number;
  waitTimeMinutes: number;
};

type TicketResult = {
  ticket: {
    id: string;
    tokenNumber: string;
    pool: "standard" | "priority" | "appointment";
    originalWaitEstimateMinutes: number;
  };
  linkedTicket?: {
    id: string;
    tokenNumber: string;
    originalWaitEstimateMinutes: number;
  } | null;
};

const steps = ["Queue", "Details", "Token"];

export default function JoinQueuePage({
  params,
}: {
  params: Promise<{ branchId: string; locale: string }>;
}) {
  const { branchId } = use(params);
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get("serviceId");

  const [step, setStep] = useState(1);
  const [branch, setBranch] = useState<BranchMetric | null>(null);
  const [services, setServices] = useState<ServiceMetric[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [linkedEnabled, setLinkedEnabled] = useState(false);
  const [linkedServiceId, setLinkedServiceId] = useState<string | null>(null);
  const [pool, setPool] = useState<"standard" | "priority">("standard");
  const [priorityDeclarationChecked, setPriorityDeclarationChecked] = useState(false);
  const [details, setDetails] = useState<CustomerDetailsValue>({
    name: "",
    phone: "",
    nic: "",
    language: locale === "si" || locale === "ta" ? locale : "en",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketResult | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/customer/branches"),
      fetch(`/api/customer/branches/${branchId}/services`),
    ])
      .then(async ([branchesResponse, servicesResponse]) => {
        const branches = await branchesResponse.json();
        const serviceList = await servicesResponse.json();
        setBranch(branches.find((item: BranchMetric) => item.id === branchId) ?? null);
        setServices(serviceList);

        if (!initialServiceId && serviceList[0]?.id) {
          setSelectedServiceId(serviceList[0].id);
        }
      })
      .catch(() => setError("We could not load this branch. Please try again."))
      .finally(() => setLoading(false));
  }, [branchId, initialServiceId]);

  const selectedService = services.find((service) => service.id === selectedServiceId);
  const linkedService = services.find((service) => service.id === linkedServiceId);
  const nicRequired = Boolean(selectedService?.nicRequired || linkedService?.nicRequired);
  const phoneDigits = details.phone.replace(/\D/g, "");

  const detailsValid = useMemo(() => {
    const validName = details.name.trim().length >= 2;
    const validPhone = /^0?7\d{8}$/.test(phoneDigits);
    const validNic = details.nic.trim().length > 0 ? isValidNic(details.nic.trim()) : !nicRequired;
    return validName && validPhone && validNic;
  }, [details.name, details.nic, nicRequired, phoneDigits]);

  const canContinueFromStepOne =
    Boolean(selectedServiceId) &&
    (!linkedEnabled || Boolean(linkedServiceId)) &&
    (pool !== "priority" || priorityDeclarationChecked);

  const submitTicket = async () => {
    if (!selectedServiceId || !detailsValid) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/queue/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceId: selectedServiceId,
          pool,
          customerDetails: {
            name: details.name.trim(),
            phone: phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`,
            nic: details.nic.trim() || undefined,
          },
          linkedServiceId: linkedEnabled ? linkedServiceId ?? undefined : undefined,
          language: details.language,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Ticket could not be issued.");
      }

      setResult(payload);
      setStep(3);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Ticket could not be issued.");
    } finally {
      setSubmitting(false);
    }
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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Join queue</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{branch?.name ?? "Selected branch"}</h1>
        {selectedService && (
          <p className="text-lg text-zinc-400">
            {selectedService.name} currently has about {formatWaitTime(selectedService.waitTimeMinutes)} wait time.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((label, index) => {
          const active = step >= index + 1;
          return (
            <div key={label} className={`rounded-full px-3 py-2 text-center text-sm font-semibold ${active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-500"}`}>
              {label}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-100">Choose queue type</h2>
            <QueueTypeSelector
              value={pool}
              onChange={setPool}
              priorityDeclarationChecked={priorityDeclarationChecked}
              onPriorityDeclarationChange={setPriorityDeclarationChecked}
            />
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Selected service</h2>
                <p className="mt-1 text-sm text-zinc-500">Change it here if needed.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <ServiceCategoryCard
                  key={service.id}
                  id={service.id}
                  name={service.name}
                  nameSi={service.nameSi}
                  nameTa={service.nameTa}
                  iconName={service.icon}
                  waitingCount={service.waitingCount}
                  waitTimeMinutes={service.waitTimeMinutes}
                  locale={locale}
                  selected={selectedServiceId === service.id}
                  onClick={(id) => {
                    setSelectedServiceId(id);
                    if (linkedServiceId === id) setLinkedServiceId(null);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <button
              type="button"
              onClick={() => {
                setLinkedEnabled((current) => {
                  const next = !current;
                  if (!next) setLinkedServiceId(null);
                  return next;
                });
              }}
              className="flex min-h-[60px] w-full items-center justify-between gap-4 text-left"
            >
              <span>
                <span className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                  <Link2 className="h-5 w-5 text-emerald-300" />
                  Need two services?
                </span>
                <span className="mt-1 block text-sm text-zinc-400">Create a linked second token for another service today.</span>
              </span>
              <span className={`h-7 w-12 rounded-full p-1 transition ${linkedEnabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition ${linkedEnabled ? "translate-x-5" : ""}`} />
              </span>
            </button>

            {linkedEnabled && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {services
                  .filter((service) => service.id !== selectedServiceId)
                  .map((service) => (
                    <ServiceCategoryCard
                      key={service.id}
                      id={service.id}
                      name={service.name}
                      nameSi={service.nameSi}
                      nameTa={service.nameTa}
                      iconName={service.icon}
                      waitingCount={service.waitingCount}
                      waitTimeMinutes={service.waitTimeMinutes}
                      locale={locale}
                      selected={linkedServiceId === service.id}
                      onClick={setLinkedServiceId}
                    />
                  ))}
              </div>
            )}
          </section>

          <button
            type="button"
            disabled={!canContinueFromStepOne}
            onClick={() => setStep(2)}
            className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Continue <ArrowRight className="h-5 w-5" />
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
              onClick={submitTicket}
              className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Confirm and get token
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">Token issued</p>
            <h2 className="mt-2 text-5xl font-black tracking-tight text-zinc-50">{result.ticket.tokenNumber}</h2>
            <p className="mt-3 text-zinc-300">
              {result.ticket.pool === "priority" ? "Priority Queue" : "Standard Queue"}.
              Estimated wait is {formatWaitTime(result.ticket.originalWaitEstimateMinutes)}.
            </p>
            <p className="mt-2 text-sm text-zinc-400">A confirmation SMS has been logged for your phone number.</p>
          </section>

          {result.linkedTicket && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
                <Copy className="h-5 w-5 text-emerald-300" />
                Second service token
              </h3>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-950 p-4">
                <span className="text-3xl font-black text-zinc-50">{result.linkedTicket.tokenNumber}</span>
                <span className="flex items-center gap-2 text-zinc-400">
                  <Clock className="h-4 w-4" />
                  {formatWaitTime(result.linkedTicket.originalWaitEstimateMinutes)}
                </span>
              </div>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/track/${result.ticket.id}`}
              className="flex min-h-[60px] items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white transition hover:bg-emerald-500"
            >
              Track my token
            </Link>
            <Link
              href="/"
              className="flex min-h-[60px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-6 text-lg font-semibold text-zinc-200 transition hover:border-zinc-700"
            >
              Back to branches
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

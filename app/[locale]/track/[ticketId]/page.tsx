"use client";

import { use, useEffect, useState } from "react";
import { ArrowLeft, Clock, Link2, Loader2, Star } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { formatWaitTime } from "@/lib/utils";

type TicketData = {
  id: string;
  tokenNumber: string;
  pool: "standard" | "priority" | "appointment";
  status: string;
  position: number | null;
  waitEstimateMinutes: number;
  customerName: string | null;
  service: { name: string; nameSi: string; nameTa: string; category: string } | null;
  counterName: string | null;
  linkedTicket: { id: string; tokenNumber: string; status: string; serviceName: string } | null;
  calledAt: string | null;
  doneAt: string | null;
  createdAt: string;
  branchId: string;
};

const statusLabels: Record<string, string> = {
  waiting: "Waiting",
  called: "Called",
  in_service: "In Service",
  done: "Done",
  no_show: "No Show",
  transferred: "Transferred",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

const poolColors: Record<string, string> = {
  appointment: "border-l-amber-500 bg-amber-500/10 text-amber-300",
  priority: "border-l-rose-500 bg-rose-500/10 text-rose-300",
  standard: "border-l-emerald-500 bg-emerald-500/10 text-emerald-300",
};

export default function TicketTrackPage({
  params,
}: {
  params: Promise<{ ticketId: string; locale: string }>;
}) {
  const { ticketId } = use(params);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchTicket() {
      try {
        const res = await fetch(`/api/customer/tickets/${ticketId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Ticket not found");
          throw new Error("Failed to load ticket");
        }
        const data = await res.json();
        setTicket(data);
        // Auto-redirect to feedback page when service is done
        if (data.status === "done") {
          router.push(`/track/${ticketId}/feedback`);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load ticket");
      } finally {
        setLoading(false);
      }
    }
    fetchTicket();
    const interval = setInterval(fetchTicket, 10000);
    return () => clearInterval(interval);
  }, [ticketId]);

  async function submitFeedback() {
    if (feedbackRating === 0) return;
    try {
      const res = await fetch("/api/customer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, rating: feedbackRating, tags: [], comment: "" }),
      });
      if (res.ok) setFeedbackSubmitted(true);
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4">
        <p className="text-zinc-400">{error ?? "Ticket not found"}</p>
        <Link href="/branch" className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white">
          Back to branches
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-6">
        <Link href="/branch" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Home</Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
          <div className={`rounded-2xl border-l-4 p-5 ${poolColors[ticket.pool] ?? poolColors.standard}`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              {ticket.pool === "appointment" ? "Appointment" : ticket.pool === "priority" ? "Priority" : "Standard"}
            </p>
            <h1 className="mt-1 text-5xl font-black tracking-tight text-zinc-50">{ticket.tokenNumber}</h1>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</p>
              <p className="mt-1 text-lg font-bold text-zinc-100">{statusLabels[ticket.status] ?? ticket.status}</p>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Position</p>
              <p className="mt-1 text-lg font-bold text-zinc-100">
                {ticket.position !== null ? `#${ticket.position}` : "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Est. Wait</p>
              <p className="mt-1 text-lg font-bold text-zinc-100">
                <Clock className="mr-1.5 inline-block h-4 w-4 text-emerald-400" />
                {formatWaitTime(ticket.waitEstimateMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Service</p>
              <p className="mt-1 text-lg font-bold text-zinc-100">{ticket.service?.name ?? "General"}</p>
            </div>
          </div>

          {ticket.counterName && (
            <div className="mt-4 rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Counter</p>
              <p className="mt-1 text-lg font-bold text-emerald-300">{ticket.counterName}</p>
            </div>
          )}

          {ticket.linkedTicket && (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <Link2 className="h-4 w-4 text-emerald-400" />
                Linked Service
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xl font-bold text-zinc-50">{ticket.linkedTicket.tokenNumber}</span>
                <span className="text-sm text-zinc-400">{ticket.linkedTicket.serviceName}</span>
              </div>
            </div>
          )}

          {ticket.status === "done" && !feedbackSubmitted && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <Star className="h-4 w-4 text-amber-400" />
                Rate your experience
              </h3>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    className={`h-10 w-10 rounded-xl border text-lg transition-all ${
                      star <= feedbackRating
                        ? "border-amber-500 bg-amber-500/20 text-amber-400"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    {star}
                  </button>
                ))}
              </div>
              {feedbackRating > 0 && (
                <button
                  onClick={submitFeedback}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Submit Feedback
                </button>
              )}
            </div>
          )}

          {feedbackSubmitted && (
            <div className="mt-6 rounded-2xl border border-emerald-800 bg-emerald-900/20 p-5 text-center">
              <p className="text-sm font-semibold text-emerald-300">Thank you for your feedback!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

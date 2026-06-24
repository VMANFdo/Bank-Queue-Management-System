"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { 
  Play, CheckCircle, RefreshCw, XCircle, LogOut, 
  Coffee, ShieldAlert, Users, Clock, AlertTriangle, ArrowRightLeft, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

// Create Browser Supabase Client
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TellerConsole() {
  const router = useRouter();

  // Setup / Context States
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedCounterId, setSelectedCounterId] = useState<string>("");

  // Running Active States
  const [activeCounter, setActiveCounter] = useState<any>(null);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [upcomingQueue, setUpcomingQueue] = useState<any[]>([]);
  const [handledServices, setHandledServices] = useState<any[]>([]);
  
  // Modals & Action States
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakDuration, setBreakDuration] = useState(15);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferServiceId, setTransferServiceId] = useState("");
  const [transferReason, setTransferReason] = useState<"normal" | "wrong_counter">("normal");
  
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Serve & Undo timers
  const [serveTime, setServeTime] = useState(0);
  const [undoTicketId, setUndoTicketId] = useState<string | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(0);

  const serveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Authentication & Setup data fetch
  useEffect(() => {
    async function checkAuthAndFetch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }
        setCurrentUser(user);

        // Fetch Branch/Counter lists for selection
        const res = await fetch("/api/staff/setup");
        const data = await res.json();
        setSetupData(data);

        // Pre-select if user is already assigned to a counter
        if (data.counters) {
          const activeCnt = data.counters.find((c: any) => c.assignedTellerId === user.id);
          if (activeCnt) {
            setSelectedBranchId(activeCnt.branchId);
            setSelectedCounterId(activeCnt.id);
            await fetchCounterStatus(activeCnt.id);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load configuration.");
      } finally {
        setLoading(false);
      }
    }
    checkAuthAndFetch();
  }, [router]);

  // 2. Queue Status Fetcher
  async function fetchCounterStatus(counterId: string) {
    try {
      const res = await fetch(`/api/queue/status?counterId=${counterId}`);
      if (!res.ok) throw new Error("Failed to fetch queue status");
      const data = await res.json();

      setActiveCounter(data.counter);
      setCurrentTicket(data.currentTicket);
      setUpcomingQueue(data.upcomingQueue || []);

      if (setupData?.services) {
        const servicesForCounter = setupData.services.filter((s: any) => 
          data.serviceIds.includes(s.id)
        );
        setHandledServices(servicesForCounter);
      }
    } catch (err: any) {
      console.error(err);
      setError("Error synchronization check: " + err.message);
    }
  }

  // 3. Realtime Listener Subscription
  useEffect(() => {
    if (!selectedCounterId || !activeCounter) return;

    // Subscribes to changes on tickets and counters for this branch
    const channel = supabase
      .channel(`teller-realtime-${selectedCounterId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tickets", 
          filter: `branch_id=eq.${activeCounter.branchId}` 
        },
        () => {
          fetchCounterStatus(selectedCounterId);
        }
      )
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "counters", 
          filter: `id=eq.${selectedCounterId}` 
        },
        () => {
          fetchCounterStatus(selectedCounterId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCounterId, activeCounter, setupData]);

  // 4. Timer handling for current ticket service duration
  useEffect(() => {
    if (serveIntervalRef.current) clearInterval(serveIntervalRef.current);

    if (currentTicket && currentTicket.status === "called") {
      const startTime = currentTicket.calledAt 
        ? new Date(currentTicket.calledAt).getTime() 
        : Date.now();

      serveIntervalRef.current = setInterval(() => {
        setServeTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setServeTime(0);
    }

    return () => {
      if (serveIntervalRef.current) clearInterval(serveIntervalRef.current);
    };
  }, [currentTicket]);

  // 5. Timer handling for 60s Undo Window
  useEffect(() => {
    if (undoTimeLeft > 0) {
      undoIntervalRef.current = setInterval(() => {
        setUndoTimeLeft((prev) => {
          if (prev <= 1) {
            setUndoTicketId(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    }

    return () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, [undoTimeLeft]);

  // 6. Action Handlers calling APIs
  async function handleOpenCounter() {
    if (!selectedCounterId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/counter-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId: selectedCounterId, status: "available" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open counter");

      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseCounter() {
    if (!selectedCounterId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/counter-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId: selectedCounterId, status: "closed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close counter");

      setActiveCounter(null);
      setCurrentTicket(null);
      setUpcomingQueue([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCallNext() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/call-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId: selectedCounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to call next ticket");

      // Check if ticket was held
      if (data.held) {
        setError("Partner ticket is active at another counter. Ticket has been placed on hold.");
      } else {
        // Trigger browser audio text-to-speech for local announcement chime simulation
        if (data.ticket) {
          const utterance = new SpeechSynthesisUtterance(
            `Ticket Number ${data.ticket.tokenNumber.split("").join(" ")} Please proceed to ${activeCounter.name}`
          );
          window.speechSynthesis.speak(utterance);
        }
      }

      setUndoTicketId(null); // Clear undo state
      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkDone() {
    if (!currentTicket) return;
    setActionLoading(true);
    setError(null);
    const targetTicketId = currentTicket.id;
    try {
      const res = await fetch("/api/queue/mark-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: targetTicketId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete ticket");

      // Initialize 60s Undo window
      setUndoTicketId(targetTicketId);
      setUndoTimeLeft(60);

      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndoMarkDone() {
    if (!undoTicketId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/undo-mark-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: undoTicketId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to undo complete");

      setUndoTicketId(null);
      setUndoTimeLeft(0);
      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNoShow() {
    if (!currentTicket) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/no-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: currentTicket.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to report no-show");

      if (data.status === "waiting") {
        setError(`Ticket ${data.tokenNumber} requeued to original pool for a single retry.`);
      } else {
        setError(`Ticket ${data.tokenNumber} marked as final no-show.`);
      }

      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecall() {
    if (!currentTicket) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: currentTicket.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to recall ticket");

      const utterance = new SpeechSynthesisUtterance(
        `Recall: Ticket Number ${currentTicket.tokenNumber.split("").join(" ")} Proceed to ${activeCounter.name}`
      );
      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBreak() {
    setIsBreakModalOpen(false);
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/start-break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId: selectedCounterId, expectedMinutes: breakDuration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate break");

      if (data.requireOverride) {
        setError(`Break denied: ${data.message}`);
      } else {
        await fetchCounterStatus(selectedCounterId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEndBreak() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/end-break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId: selectedCounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to end break");

      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransfer() {
    if (!currentTicket || !transferServiceId) return;
    setIsTransferModalOpen(false);
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: currentTicket.id,
          destinationServiceId: transferServiceId,
          reason: transferReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer ticket");

      setError(`Ticket successfully transferred to the target service queue.`);
      await fetchCounterStatus(selectedCounterId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  // Format Helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 font-sans">
        <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading workspace configuration...</p>
      </div>
    );
  }

  // ─── STAGE A: SELECT BRANCH AND COUNTER ────────────────────────────────────────
  if (!activeCounter) {
    const branchesList = setupData?.branches || [];
    const countersList = setupData?.counters?.filter((c: any) => c.branchId === selectedBranchId) || [];

    return (
      <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 select-none overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute top-[20%] left-[20%] w-[450px] h-[450px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[450px] h-[450px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 backdrop-blur-2xl relative z-10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-2xl tracking-tight mb-4">
              B
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Teller Workstation</h1>
            <p className="text-xs text-zinc-400 mt-1">Configure branch and counter assignment to open console</p>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
                Select Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedCounterId("");
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all duration-300"
              >
                <option value="">-- Choose Branch --</option>
                {branchesList.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
                Select Counter
              </label>
              <select
                value={selectedCounterId}
                disabled={!selectedBranchId}
                onChange={(e) => setSelectedCounterId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all duration-300 disabled:opacity-50"
              >
                <option value="">-- Choose Counter --</option>
                {countersList.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status !== "closed" ? `(${c.status})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-950/30 border border-red-950 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleOpenCounter}
              disabled={!selectedCounterId || actionLoading}
              className="w-full py-4 px-6 mt-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/20 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-center flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span>Open Workstation</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-xl border border-zinc-850 hover:bg-zinc-850/50 text-zinc-400 hover:text-white text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── STAGE B: ACTIVE TELLER WORKSPACE ──────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden font-sans select-none">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* Header bar */}
      <header className="w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-lg">
              B
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-white leading-none">
                {activeCounter.name}
              </h1>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5 block">
                {setupData?.branches?.find((b: any) => b.id === activeCounter.branchId)?.name || "Active Branch"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-3 py-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                activeCounter.status === "available" ? "bg-emerald-400 animate-pulse" :
                activeCounter.status === "on_break" ? "bg-amber-400 animate-pulse" : "bg-red-400"
              )} />
              <span className="text-xs font-semibold capitalize text-zinc-200">
                {activeCounter.status.replace("_", " ")}
              </span>
            </div>

            {/* Break / End Break */}
            {activeCounter.status === "available" && (
              <button
                onClick={() => setIsBreakModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-500 hover:bg-amber-500/10 transition-all duration-300 flex items-center gap-1.5"
              >
                <Coffee className="h-3.5 w-3.5" />
                Start Break
              </button>
            )}
            {activeCounter.status === "on_break" && (
              <button
                onClick={handleEndBreak}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all duration-300 flex items-center gap-1.5 animate-pulse"
              >
                <Coffee className="h-3.5 w-3.5" />
                End Break
              </button>
            )}

            {/* Close Counter & Logout */}
            <button
              onClick={handleCloseCounter}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-red-400 transition-all duration-200"
            >
              Close Counter
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-10">
        
        {/* Left Columns (Servicing Panel) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {error && (
            <div className="p-4 bg-red-950/20 border border-red-900/50 text-red-400 text-sm rounded-2xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notification Notice</p>
                <p className="text-xs text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* 60s UNDO ALERT BANNER */}
          {undoTicketId && (
            <div className="relative overflow-hidden p-4 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-sm rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Ticket marked done</p>
                  <p className="text-xs text-emerald-300">You have {undoTimeLeft}s remaining to revert completion.</p>
                </div>
              </div>
              <button
                onClick={handleUndoMarkDone}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider transition-all duration-200"
              >
                Undo Complete
              </button>
              {/* Shinking countdown progress line */}
              <div 
                className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(undoTimeLeft / 60) * 100}%` }}
              />
            </div>
          )}

          {/* CURRENT ACTIVE TICKET PANEL */}
          <div className="bg-zinc-900/50 border border-zinc-850 rounded-3xl p-8 backdrop-blur-md relative shadow-xl overflow-hidden">
            {activeCounter.status === "on_break" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Coffee className="h-16 w-16 text-amber-500 animate-bounce mb-4" />
                <h3 className="text-xl font-bold text-white">Teller is on break</h3>
                <p className="text-xs text-zinc-400 max-w-xs mt-2">
                  Expected duration: {activeCounter.breakExpectedMinutes} mins. Reopen the counter (or end break) to call next customers.
                </p>
              </div>
            ) : currentTicket ? (
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      currentTicket.pool === "appointment" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                      currentTicket.pool === "priority" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                      "bg-zinc-800 text-zinc-300 border border-zinc-700"
                    )}>
                      {currentTicket.pool} pool
                    </span>
                  </div>
                  
                  {/* Service Timer */}
                  <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 rounded-full font-mono text-sm font-semibold">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <span>{formatTime(serveTime)}</span>
                  </div>
                </div>

                {/* Big Token Number */}
                <div className="text-center py-8">
                  <span className="text-7xl sm:text-8xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-500 select-all font-mono">
                    {currentTicket.tokenNumber}
                  </span>
                  <h3 className="text-lg font-bold text-emerald-400 tracking-wide mt-4">
                    {setupData?.services?.find((s: any) => s.id === currentTicket.serviceId)?.name || "Financial Service"}
                  </h3>
                </div>

                <div className="border-t border-zinc-850/80 pt-6 mt-2 grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-850">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Customer details</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {currentTicket.customerName}
                    </span>
                  </div>
                  <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-850">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">NIC Reference</span>
                    <span className="text-sm font-mono font-bold text-zinc-300 mt-1 block">
                      {currentTicket.nic ? currentTicket.nic.replace(/(.{4}).*(.{3})/, "$1****$2") : "Not Provided"}
                    </span>
                  </div>
                </div>

                {/* Linked Ticket Pair warning */}
                {currentTicket.linkedTicketId && (
                  <div className="mt-4 p-4 bg-zinc-950/60 border border-zinc-800 rounded-2xl flex items-center gap-3">
                    <ArrowRightLeft className="h-5 w-5 text-teal-400 shrink-0" />
                    <div className="text-xs">
                      <span className="font-bold text-teal-300">Linked-Pair Ticket detected.</span>
                      <span className="text-zinc-400 ml-1">
                        Ensure second counter completes partner workflow before serving.
                      </span>
                    </div>
                  </div>
                )}

                {/* CONTROL BUTTONS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                  <button
                    onClick={handleMarkDone}
                    disabled={actionLoading}
                    className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Done
                  </button>

                  <button
                    onClick={handleRecall}
                    disabled={actionLoading}
                    className="py-3.5 px-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 font-semibold text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Recall
                  </button>

                  <button
                    onClick={handleNoShow}
                    disabled={actionLoading}
                    className="py-3.5 px-4 rounded-2xl border border-zinc-850 hover:bg-red-950/20 hover:border-red-950 text-zinc-400 hover:text-red-400 font-semibold text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    No Show
                  </button>

                  <button
                    onClick={() => {
                      setTransferServiceId("");
                      setIsTransferModalOpen(true);
                    }}
                    disabled={actionLoading}
                    className="py-3.5 px-4 rounded-2xl border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-semibold text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2 col-span-2 sm:col-span-1"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transfer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-16 w-16 text-zinc-700 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-zinc-400">Ready to Serve</h3>
                <p className="text-xs text-zinc-500 max-w-xs mt-2 mb-6">
                  Counter is open. Press "Call Next" to process the waiting queue sequence.
                </p>
                <button
                  onClick={handleCallNext}
                  disabled={actionLoading}
                  className="py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/10 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Call Next Customer</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns (Queue Info & Handled services) */}
        <div className="flex flex-col gap-6">
          
          {/* UPCOMING WAITING QUEUE */}
          <div className="bg-zinc-900/50 border border-zinc-850 rounded-3xl p-6 backdrop-blur-md shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4 flex items-center justify-between">
              <span>Upcoming Queue</span>
              <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 text-[10px] font-bold font-mono">
                {upcomingQueue.length} waiting
              </span>
            </h3>

            {upcomingQueue.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {upcomingQueue.map((ticket, idx) => (
                  <div 
                    key={ticket.id}
                    className="p-3.5 bg-zinc-950/40 border border-zinc-850/60 rounded-2xl flex items-center justify-between hover:border-zinc-700/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-sm text-zinc-100 bg-zinc-900 border border-zinc-850 px-2.5 py-1.5 rounded-xl">
                        {ticket.tokenNumber}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-zinc-300 block leading-tight">
                          {setupData?.services?.find((s: any) => s.id === ticket.serviceId)?.name || "Service"}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">
                          {ticket.customerName}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase",
                        ticket.pool === "appointment" ? "bg-emerald-500/10 text-emerald-400" :
                        ticket.pool === "priority" ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-850 text-zinc-400"
                      )}>
                        {ticket.pool}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-zinc-950/20 border border-dashed border-zinc-850 rounded-2xl text-xs text-zinc-500">
                Queue is currently empty.
              </div>
            )}
          </div>

          {/* HANDLED SERVICES */}
          <div className="bg-zinc-900/50 border border-zinc-850 rounded-3xl p-6 backdrop-blur-md shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Assigned Services</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {handledServices.map((svc) => (
                <span 
                  key={svc.id}
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-850 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {svc.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ─── MODAL: START BREAK ────────────────────────────────────────────── */}
      {isBreakModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2">Request Break</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Queue engine will automatically redistribute your waiting tickets to other open counters handling matching services.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
                  Expected Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartBreak}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs tracking-wider transition-all duration-200"
              >
                Go on Break
              </button>
              <button
                onClick={() => setIsBreakModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-zinc-805 hover:bg-zinc-850 text-zinc-400 hover:text-white font-semibold text-xs tracking-wider transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: TRANSFER TICKET ────────────────────────────────────────── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2">Transfer Ticket</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Reroute this customer to a different service department queue.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
                  Target Service
                </label>
                <select
                  value={transferServiceId}
                  onChange={(e) => setTransferServiceId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Target Service --</option>
                  {setupData?.services
                    ?.filter((s: any) => s.id !== currentTicket?.serviceId)
                    ?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
                  Transfer Reason
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferReason("normal")}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-xl border transition-all duration-200",
                      transferReason === "normal" 
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" 
                        : "border-zinc-800 bg-zinc-950 text-zinc-400"
                    )}
                  >
                    Regular Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferReason("wrong_counter")}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-xl border transition-all duration-200",
                      transferReason === "wrong_counter" 
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" 
                        : "border-zinc-800 bg-zinc-950 text-zinc-400"
                    )}
                  >
                    Front of Line
                  </button>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1.5 block leading-normal">
                  "Front of Line" overrides queue priority to correct routing system errors for the customer.
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={!transferServiceId}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider transition-all duration-200 disabled:opacity-50"
              >
                Transfer Now
              </button>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-zinc-805 hover:bg-zinc-850 text-zinc-400 hover:text-white font-semibold text-xs tracking-wider transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

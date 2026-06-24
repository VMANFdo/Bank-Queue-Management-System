import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function Home() {
  const t = useTranslations("common");
  const navT = useTranslations("nav");
  const branchT = useTranslations("branch");

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between overflow-hidden font-sans select-none">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-xl tracking-tight">
            B
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">
              {t("appName")}
            </h1>
            <span className="text-xs text-zinc-400 font-medium">
              Queue Management System
            </span>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 rounded-full p-1 backdrop-blur-md">
          <Link
            href="/"
            locale="en"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 hover:text-white hover:bg-zinc-800 text-zinc-300"
          >
            English
          </Link>
          <Link
            href="/"
            locale="si"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 hover:text-white hover:bg-zinc-800 text-zinc-300"
          >
            සිංහල
          </Link>
          <Link
            href="/"
            locale="ta"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 hover:text-white hover:bg-zinc-800 text-zinc-300"
          >
            தமிழ்
          </Link>
        </div>

        {/* Sign In */}
        <Link
          href="/auth/login"
          className="px-4 py-2 rounded-full text-xs font-semibold tracking-wide border border-zinc-700 text-zinc-300 hover:text-white hover:border-emerald-500 hover:bg-emerald-500/10 transition-all duration-300"
        >
          Sign in
        </Link>
      </header>

      {/* Hero Content */}
      <main className="w-full max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center justify-center flex-1 z-10 gap-10">
        <div className="flex flex-col items-center gap-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            System Bootstrapped & Active
          </div>
          
          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Smart Queuing for <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 animate-gradient-flow">
              Modern Banking
            </span>
          </h2>
          
          <p className="text-lg text-zinc-400 max-w-xl leading-relaxed mt-2">
            A real-time, multi-branch queue platform optimized for Sri Lankan bank branches. Supports trilingual localization, priority scheduling, and teller orchestration.
          </p>
        </div>

        {/* Buttons / Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/branch"
            className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/20 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-center"
          >
            {navT("bookAppointment")}
          </Link>
          <Link
            href="/branch"
            className="flex-1 py-4 px-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold text-sm tracking-wide hover:bg-zinc-850 hover:text-white hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-center backdrop-blur-sm"
          >
            {branchT("findBranch")}
          </Link>
        </div>

        {/* Surfaces Grid */}
        <div className="w-full grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 max-w-6xl">
          {[
            { name: "Customer Web App", desc: "Ticket booking & live tracking", route: "/branch" },
            { name: "Teller Console", desc: "Counter ticket management", route: "/teller" },
            { name: "Manager Dashboard", desc: "Live branch health & SLAs", route: "/manager" },
            { name: "Hall Display Board", desc: "Trilingual voice announcing", route: "/display" },
            { name: "HO Admin Portal", desc: "Multi-branch setup & invite flow", route: "/admin" },
          ].map((surface, idx) => (
            <Link
              href={surface.route}
              key={idx}
              className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700/60 transition-all duration-300 flex flex-col justify-between text-left backdrop-blur-sm hover:translate-y-[-2px]"
            >
              <div>
                <div className="h-2 w-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 mb-3" />
                <h3 className="font-semibold text-white text-sm tracking-tight mb-1">
                  {surface.name}
                </h3>
                <p className="text-xs text-zinc-400 leading-normal">
                  {surface.desc}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mt-4 block">
                Phase {7 + idx} UI
              </span>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 z-10">
        © 2026 {t("appName")} • Sri Lanka Queue Management Initiative
      </footer>
    </div>
  );
}

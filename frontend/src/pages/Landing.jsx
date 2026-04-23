import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import Navbar from "../components/Navbar";
import { ArrowRight, Clock, Users, QrCode, Sparkles, CheckCircle2 } from "lucide-react";

const stats = [
  { value: "86", label: "Avg. daily walk-ins", note: "across 3 branches" },
  { value: "31%", label: "Fewer no-shows", note: "with live status updates" },
  { value: "~95%", label: "Wait-time accuracy", note: "recomputed every move" },
  { value: "<2m", label: "Owner setup time", note: "no technical skills" },
];

const features = [
  {
    icon: Users,
    title: "Walk-ins + remote join in one flow",
    body: "Merge spontaneous walk-ins with customers who joined online. One board, one source of truth.",
  },
  {
    icon: Clock,
    title: "Live wait estimates",
    body: "Every call-next recomputes remaining wait so guests always know where they stand.",
  },
  {
    icon: QrCode,
    title: "QR code join",
    body: "Print one QR at the front desk. Guests scan, enter their name, and watch the queue tick down.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C302E]">
      <Navbar transparent />

      <section className="warm-hero-gradient grain relative">
        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]" data-testid="hero-eyebrow">
                Go-Next · Organic Queue Platform
              </p>
              <h1 className="font-serif-display mt-4 text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                A calmer way<br />
                <span className="italic text-[#A86246]">to keep every chair busy.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-stone-600">
                Built for real service floors: morning rush, weekend peaks, and the in-between walk-ins.
                Owners get a grounded dashboard. Guests get transparent wait times.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 stagger-in">
                <Link to="/register" data-testid="hero-cta-register">
                  <Button className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white h-12 px-7 press">
                    Start free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/join/demo-salon" data-testid="hero-cta-demo">
                  <Button variant="outline" className="rounded-full h-12 px-7 border-stone-300 hover:bg-white/70 press">
                    Try the customer demo
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="border-l border-stone-300 pl-4" data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                    <p className="font-serif-display text-3xl">{s.value}</p>
                    <p className="text-xs font-medium text-stone-700">{s.label}</p>
                    <p className="text-[11px] text-stone-500">{s.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white/70 backdrop-blur-xl shadow-sm">
                <img
                  src="https://images.pexels.com/photos/7195812/pexels-photo-7195812.jpeg"
                  alt="A calm salon interior"
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Now serving</p>
                      <p className="font-serif-display text-2xl text-[#2C302E]">Token · 014</p>
                    </div>
                    <span className="rounded-full bg-[#7D9276]/15 px-3 py-1 text-xs font-medium text-[#4c6547]" data-testid="hero-badge-live">
                      Live
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div className="h-full w-3/5 bg-gradient-to-r from-[#E3A587] to-[#C47C5C]" />
                  </div>
                  <p className="mt-2 text-xs text-stone-600">3 ahead of you · ~8 min wait</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Why Go-Next</p>
          <h2 className="font-serif-display mt-3 text-3xl sm:text-4xl lg:text-5xl leading-tight">
            Thoughtfully quiet software. <br />
            <span className="italic">Built around the service floor.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3 stagger-in">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-stone-200 bg-white p-7 transition press hover:-translate-y-1 hover:shadow-lg"
              data-testid={`feature-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFE8] text-[#A86246]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-serif-display mt-5 text-2xl leading-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F4EFE8]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center lg:py-28">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">How it works</p>
            <h2 className="font-serif-display mt-3 text-3xl sm:text-4xl lg:text-5xl leading-tight">
              Four steady steps <br />
              <span className="italic">from walk-in to “thank you.”</span>
            </h2>
            <ol className="mt-10 space-y-6">
              {[
                { t: "Create your business", b: "Sign up once. Name, address, number of stations — done." },
                { t: "Print your QR", b: "Guests scan it, enter a name, and join the live queue." },
                { t: "Call next, tap done", b: "Your dashboard moves tokens between Waiting and Serving." },
                { t: "Everyone keeps rhythm", b: "Stations stay full. Guests stay informed. No double bookings." },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-5">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[#C47C5C] text-[#A86246] font-serif-display text-lg">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-serif-display text-xl">{s.t}</p>
                    <p className="text-sm text-stone-600">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white">
            <img
              src="https://images.unsplash.com/photo-1776775088350-836bc9a3af80"
              alt="Guest waiting and checking phone"
              className="aspect-[5/6] w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 lg:py-28 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-[#C47C5C]" />
        <h2 className="font-serif-display mt-4 text-3xl sm:text-4xl lg:text-5xl leading-tight">
          Ready to stop juggling a paper notebook?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-stone-600">
          Go-Next is free to start. No card. No contracts. Bring your own stations.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" data-testid="final-cta-register">
            <Button className="rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white h-12 px-8 press">
              Create your account
            </Button>
          </Link>
          <Link to="/login" data-testid="final-cta-login">
            <Button variant="outline" className="rounded-full border-stone-300 h-12 px-8 press">
              I already have one
            </Button>
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-500">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#7D9276]" /> Free tier forever</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#7D9276]" /> No app to install</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#7D9276]" /> Works on any phone</span>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <p className="text-xs text-stone-500">© {new Date().getFullYear()} Go-Next Queue Platform</p>
          <div className="flex gap-4 text-xs text-stone-600">
            <Link to="/login" className="hover:text-stone-900">Sign in</Link>
            <Link to="/register" className="hover:text-stone-900">Create account</Link>
            <Link to="/join/demo-salon" className="hover:text-stone-900">Demo queue</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

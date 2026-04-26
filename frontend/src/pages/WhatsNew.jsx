import { useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { RELEASES, LATEST_VERSION } from "../lib/releases";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Sparkles, MessageSquare } from "lucide-react";

const SEEN_KEY = "gonext:whatsnew:seen";

const tagColor = (tag) => {
  if (tag === "Major") return "bg-primary/15 text-primary border-primary/40";
  if (tag === "Launch") return "bg-success/15 text-success border-success/40";
  return "bg-stone-100 text-stone-600 border-stone-200";
};

export default function WhatsNew() {
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, LATEST_VERSION);
      // Notify same-tab listeners (DashboardHeader) that the badge should clear.
      window.dispatchEvent(new Event("gonext:whatsnew-seen"));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="queue" />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/dashboard" className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="whatsnew-back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <div className="mt-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-[11px] uppercase tracking-[0.26em] text-primary">What&apos;s new</p>
        </div>
        <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">
          Everything we&apos;ve shipped
        </h1>
        <p className="mt-3 text-stone-600 text-sm max-w-xl">
          Short, human notes on every Go-Next update. Bookmark this page — we update it as soon as a release goes out.
        </p>

        <ol className="mt-12 relative border-l border-stone-200 pl-6 space-y-12" data-testid="whatsnew-list">
          {RELEASES.map((r, idx) => (
            <li key={r.version} data-testid={`whatsnew-item-${r.version}`} className="relative">
              <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-primary border-4 border-background" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-serif-display text-2xl">{r.version}</span>
                <span className="text-xs text-stone-500">{r.date}</span>
                <Badge className={`rounded-full border font-normal ${tagColor(r.tag)}`}>{r.tag}</Badge>
                {idx === 0 && (
                  <Badge className="rounded-full border-0 bg-foreground text-white font-normal">Latest</Badge>
                )}
              </div>
              <h2 className="font-serif-display text-3xl mt-3 leading-tight">{r.title}</h2>
              <ul className="mt-5 space-y-5">
                {r.highlights.map((h) => (
                  <li key={h.heading} className="rounded-2xl border border-stone-200 bg-white p-5">
                    <p className="font-medium text-foreground">{h.heading}</p>
                    <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{h.body}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-14 rounded-2xl border border-dashed border-primary/40 bg-secondary/60 p-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-serif-display text-xl leading-tight">Something you wish Go-Next did?</p>
              <p className="mt-1.5 text-sm text-stone-600">
                Tell your account manager or drop a note — we ship based on what real owners ask for.
              </p>
              <Link to="/dashboard" className="mt-4 inline-block" data-testid="whatsnew-cta">
                <Button className="rounded-full bg-foreground hover:bg-foreground/90 text-white h-10 px-5">
                  Back to the queue
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

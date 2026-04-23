import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function Display() {
  const { businessId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/public/business/${businessId}/display`);
      setData(d);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Display unavailable");
    }
  }, [businessId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1d1c] text-stone-300 px-5">
        <div className="text-center">
          <p className="font-serif-display text-5xl">Display unavailable</p>
          <p className="mt-2 text-stone-500">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-[#1a1d1c] text-stone-300">Preparing display…</div>;
  }

  const { business, serving, upcoming, waiting_count, total_chairs } = data;
  const stations = Array.from({ length: total_chairs }, (_, i) => i + 1);
  const byChair = serving.reduce((acc, t) => {
    if (t.chair_number) acc[t.chair_number] = t;
    return acc;
  }, {});

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-[#1a1d1c] text-stone-100 relative overflow-hidden" data-testid="display-page">
      {/* Decorative warm glow */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 500px at 10% -10%, rgba(196,124,92,0.22), transparent 60%), radial-gradient(700px 400px at 110% 110%, rgba(125,146,118,0.18), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-8 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#E3A587]">Now serving</p>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-7xl leading-none mt-2">
              {business.business_name}
            </h1>
            {business.city && (
              <p className="mt-2 text-stone-400">{[business.address, business.city].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-serif-display text-5xl tabular-nums" data-testid="display-clock">{timeStr}</p>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-400 mt-1">Live</p>
          </div>
        </header>

        <section className="mt-10 grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(stations.length, 4)}, minmax(0,1fr))` }}>
          {stations.map((chair) => {
            const t = byChair[chair];
            return (
              <div
                key={chair}
                className={`rounded-3xl border ${t ? "border-[#C47C5C]/50 bg-[#2a2221]/60" : "border-white/10 bg-white/[0.03]"} p-8 min-h-[240px] flex flex-col justify-between relative overflow-hidden`}
                data-testid={`display-station-${chair}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">
                    {business.station_label || "Station"} · {chair}
                  </p>
                  <span className={`text-[10px] uppercase tracking-[0.26em] ${t ? "text-[#E3A587]" : "text-stone-500"}`}>
                    {t ? "In service" : "Available"}
                  </span>
                </div>
                {t ? (
                  <div className="mt-6">
                    <p className="font-serif-display text-7xl sm:text-8xl leading-none text-[#E3A587] tabular-nums">
                      #{String(t.token_number).padStart(3, "0")}
                    </p>
                    <p className="mt-3 font-serif-display text-3xl truncate">{t.customer_name}</p>
                  </div>
                ) : (
                  <p className="mt-6 font-serif-display text-5xl text-stone-500">—</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-3xl">Up next</h2>
              <p className="text-xs uppercase tracking-[0.26em] text-stone-400">{waiting_count} waiting</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-6 text-stone-400 font-serif-display text-2xl">No one waiting. You&apos;re all caught up.</p>
            ) : (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((t, i) => (
                  <li
                    key={t.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 flex items-center justify-between"
                    data-testid={`display-upcoming-${t.token_number}`}
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.26em] text-stone-500">Token</p>
                      <p className="font-serif-display text-3xl text-stone-100 tabular-nums">#{String(t.token_number).padStart(3, "0")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-300 text-sm truncate max-w-[140px]">{t.customer_name}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">{i === 0 ? "You&apos;re next" : `+${i + 1} away`}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 flex flex-col justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">Join the queue</p>
              <p className="mt-3 font-serif-display text-3xl leading-tight">
                Scan the QR at the front desk or visit:
              </p>
              <p className="mt-3 font-serif-display text-2xl text-[#E3A587] break-all">
                go-next.in/join/{business.id}
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500 mt-8">
              Updated every few seconds · Go-Next
            </p>
          </aside>
        </section>
      </div>
    </div>
  );
}

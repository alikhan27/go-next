import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StatCard({ label, value, accent, hint, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-[#2C302E]"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function Heatmap({ cells }) {
  // cells: [{weekday, hour, count}]
  const max = useMemo(() => cells.reduce((m, c) => Math.max(m, c.count), 0) || 1, [cells]);
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    cells.forEach((c) => {
      g[c.weekday][c.hour] = c.count;
    });
    return g;
  }, [cells]);

  const bg = (v) => {
    if (v === 0) return "#F4EFE8";
    const t = v / max; // 0..1
    // Blend from soft sand to terracotta #C47C5C
    const r = Math.round(244 + (196 - 244) * t);
    const g = Math.round(239 + (124 - 239) * t);
    const b = Math.round(232 + (92 - 232) * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 overflow-x-auto" data-testid="analytics-heatmap">
      <div className="flex items-end justify-between">
        <h3 className="font-serif-display text-xl">Busy-hour heatmap</h3>
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">when guests are served</p>
      </div>
      <div className="mt-4 min-w-[640px]">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(24, minmax(0,1fr))", columnGap: 3, rowGap: 3 }}>
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={`h-${h}`} className="text-[9px] text-stone-400 text-center">{h % 3 === 0 ? h : ""}</div>
          ))}
          {grid.map((row, wd) => (
            <div key={`row-${wd}`} className="contents">
              <div className="text-[10px] text-stone-500 pr-1 self-center">{DAY_LABELS[wd]}</div>
              {row.map((v, hr) => (
                <div
                  key={`c-${wd}-${hr}`}
                  title={`${DAY_LABELS[wd]} ${hr}:00 — ${v}`}
                  className="aspect-square rounded-[3px]"
                  style={{ backgroundColor: bg(v) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { businessId } = useParams();
  const { auth } = useAuth();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const planMaxDays = planLimits(auth?.user).analytics_days;
  const rangeOptions = useMemo(
    () => [7, 14, 30, 90, 180].filter((d) => d <= planMaxDays),
    [planMaxDays],
  );
  const [days, setDays] = useState(Math.min(14, planMaxDays));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { data: d } = await api.get(`/business/${business.id}/analytics?days=${days}`);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [business, days]);

  useEffect(() => { load(); }, [load]);

  if (auth === null) return null;
  if (!business) {
    if (businesses.length === 0) return <Navigate to="/dashboard/outlets" replace />;
    return <Navigate to={`/dashboard/${businesses[0].id}/analytics`} replace />;
  }

  const totals = data?.totals || { completed: 0, cancelled: 0, no_show: 0, no_show_rate_pct: 0, avg_service_minutes: 0 };
  const series = (data?.series || []).map((s) => ({
    ...s,
    shortDate: s.date.slice(5), // MM-DD
  }));

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <DashboardHeader activeTab="analytics" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Analytics</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">{business.business_name}</h1>
            <p className="mt-2 text-stone-600 text-sm">How your outlet has been performing.</p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-10 w-[160px] rounded-full border-stone-300 bg-white" data-testid="analytics-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeOptions.map((d) => (
                <SelectItem key={d} value={String(d)} data-testid={`analytics-range-${d}`}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Completed" value={totals.completed} accent="text-[#4c6547]" hint={`in the last ${days} days`} testid="analytics-completed" />
          <StatCard label="No-shows" value={totals.cancelled + totals.no_show} accent="text-red-600" hint={`${totals.no_show_rate_pct}% of total`} testid="analytics-noshow" />
          <StatCard label="Avg service time" value={`${totals.avg_service_minutes}m`} hint="from Call-next to Done" testid="analytics-avg-service" />
          <StatCard label="Daily average" value={totals.completed ? Math.round(totals.completed / Math.max(days, 1)) : 0} hint="completions per day" testid="analytics-daily-avg" />
        </div>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5" data-testid="analytics-series">
          <div className="flex items-end justify-between">
            <h3 className="font-serif-display text-xl">Completions per day</h3>
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.22em] text-stone-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7D9276]" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E3A587]" /> No-shows</span>
            </div>
          </div>
          <div className="mt-4 h-[280px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-stone-500">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E4E0" vertical={false} />
                  <XAxis dataKey="shortDate" stroke="#5C5F5D" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5C5F5D" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E6E4E0", fontSize: 12 }}
                    cursor={{ fill: "#F4EFE8" }}
                  />
                  <Bar dataKey="completed" fill="#7D9276" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="no_show" fill="#E3A587" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Heatmap cells={data?.heatmap || []} />
        </div>
      </main>
    </div>
  );
}

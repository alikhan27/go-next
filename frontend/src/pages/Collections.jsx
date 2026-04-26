import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import DashboardHeader from "../components/DashboardHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

function StatCard({ label, value, hint, accent, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-[#2C302E]"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function statusBadge(paid) {
  return paid
    ? "bg-[#7D9276]/15 text-[#4c6547] border-[#7D9276]/40"
    : "bg-[#E3A587]/20 text-[#A86246] border-[#E3A587]/50";
}

export default function Collections() {
  const { businessId } = useParams();
  const { auth } = useAuth();
  const { isPaidPlan, planLimits, planLabel } = usePlans();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const planMaxDays = planLimits(auth?.user).analytics_days;
  const paidPlan = isPaidPlan(auth?.user);
  const rangeOptions = useMemo(
    () => [1, 7, 14, 30, 90, 180].filter((d) => d <= planMaxDays),
    [planMaxDays],
  );
  const [days, setDays] = useState(Math.min(7, planMaxDays));
  const [paidFilter, setPaidFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paidPlan && days !== 7) {
      setDays(7);
    }
  }, [days, paidPlan]);

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const [collectionsRes, servicesRes] = await Promise.all([
        api.get(`/business/${business.id}/collections?days=${days}&paid=${paidFilter}&payment_method=${paymentMethodFilter}&service_id=${encodeURIComponent(serviceFilter)}`),
        api.get(`/business/${business.id}/services`).catch(() => ({ data: [] })),
      ]);
      setData(collectionsRes.data);
      setServices((servicesRes.data || []).filter((svc) => svc.is_active !== false));
    } finally {
      setLoading(false);
    }
  }, [business, days, paidFilter, paymentMethodFilter, serviceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (auth === null) return null;
  if (!business) {
    if (businesses.length === 0) return <Navigate to="/dashboard/outlets" replace />;
    return <Navigate to={`/dashboard/${businesses[0].id}/collections`} replace />;
  }

  const totals = data?.totals || {
    amount: 0, paid_amount: 0, unpaid_amount: 0, ticket_count: 0, paid_count: 0, unpaid_count: 0,
  };
  const rows = data?.rows || [];
  const series = (data?.series || []).map((item) => ({
    ...item,
    shortDate: item.date.slice(5),
  }));

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <DashboardHeader activeTab="collections" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Collections</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">{business.business_name}</h1>
            <p className="mt-2 text-stone-600 text-sm">
              {paidPlan
                ? "Track what came in each day and filter down to the tickets behind it."
                : "Track the last 7 days of collections. Upgrade for longer date ranges."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {paidPlan ? (
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger className="h-10 w-[140px] rounded-full border-stone-300 bg-white" data-testid="collections-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rangeOptions.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d === 1 ? "Today" : `Last ${d} days`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                className="inline-flex h-10 items-center rounded-full border border-stone-200 bg-white px-4 text-sm text-stone-700"
                data-testid="collections-range-fixed"
              >
                Last 7 days
              </div>
            )}

            <Select value={paidFilter} onValueChange={setPaidFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-full border-stone-300 bg-white" data-testid="collections-paid-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
                <SelectItem value="unpaid">Unpaid only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="h-10 w-[150px] rounded-full border-stone-300 bg-white" data-testid="collections-method-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-10 w-[180px] rounded-full border-stone-300 bg-white" data-testid="collections-service-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!paidPlan && (
          <div className="mt-5 rounded-2xl border border-[#E3D9C8] bg-[#F4EFE8] px-5 py-4" data-testid="collections-upgrade-note">
            <p className="text-sm text-stone-700">
              <span className="font-medium">{planLabel(auth?.user)} plan:</span> collections stay available for the last 7 days.
              Upgrade to Premium or Premium Plus to unlock 14, 30, 90, and 180 day views.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Collected"
            value={`₹${Number(totals.amount || 0).toLocaleString("en-IN")}`}
            hint={`${totals.ticket_count} completed tickets`}
            accent="text-[#A86246]"
            testid="collections-total"
          />
          <StatCard
            label="Paid"
            value={`₹${Number(totals.paid_amount || 0).toLocaleString("en-IN")}`}
            hint={`${totals.paid_count} tickets`}
            accent="text-[#4c6547]"
            testid="collections-paid"
          />
          <StatCard
            label="Pending"
            value={`₹${Number(totals.unpaid_amount || 0).toLocaleString("en-IN")}`}
            hint={`${totals.unpaid_count} tickets`}
            testid="collections-unpaid"
          />
          <StatCard
            label="Daily average"
            value={`₹${Math.round((totals.amount || 0) / Math.max(days, 1)).toLocaleString("en-IN")}`}
            hint={`across ${days === 1 ? "today" : `${days} days`}`}
            testid="collections-average"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5" data-testid="collections-series">
          <div className="flex items-end justify-between">
            <h3 className="font-serif-display text-xl">Daily collection</h3>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">completed tickets only</p>
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
                    formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Collection"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E6E4E0", fontSize: 12 }}
                    cursor={{ fill: "#F4EFE8" }}
                  />
                  <Bar dataKey="amount" fill="#C47C5C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white overflow-hidden" data-testid="collections-table">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="pr-5 text-right">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-stone-500">
                    No completed tickets match these filters yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-5">
                      <div>
                        <p className="font-medium text-stone-900">{row.customer_name}</p>
                        <p className="text-xs text-stone-500">#{String(row.token_number).padStart(3, "0")}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{row.finished_date}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {(row.service_names?.length ? row.service_names : row.service_name ? [row.service_name] : ["No service logged"]).map((name, index) => (
                          <span key={`${row.id}-svc-${index}`} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700">
                            {name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-stone-900">
                      ₹{Number(row.service_price || 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">
                      {row.payment_method === "online"
                        ? "Online"
                        : row.payment_method === "cash"
                          ? "Cash"
                          : "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Badge className={`rounded-full border font-normal ${statusBadge(row.paid)}`}>
                        {row.paid ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

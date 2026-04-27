import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { BadgeCheck, Edit2 } from "lucide-react";

function StatCard({ label, value, hint, accent, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-foreground"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function statusBadge(paid) {
  return paid
    ? "bg-success/15 text-success border-success/40"
    : "bg-primary/20 text-primary border-primary/50";
}

function PaymentMethodCards({ value, onChange, testidPrefix = "payment-method" }) {
  const options = [
    { id: "cash", label: "Cash", hint: "Collected at the counter" },
    { id: "online", label: "Online", hint: "UPI, card, or transfer" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              active
                ? "border-primary bg-secondary"
                : "border-stone-200 bg-white hover:border-stone-300"
            }`}
            data-testid={`${testidPrefix}-${option.id}`}
          >
            <span className="block text-sm font-medium text-stone-900">{option.label}</span>
            <span className="mt-1 block text-xs text-stone-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
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
  const [editingTicket, setEditingTicket] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [amountDialogOpen, setAmountDialogOpen] = useState(false);
  const [updatingAmount, setUpdatingAmount] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTicket, setPaymentTicket] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [updatingPayment, setUpdatingPayment] = useState(false);

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

  const openAmountDialog = (ticket) => {
    setEditingTicket(ticket);
    setEditAmount(String(ticket.service_price || 0));
    setAmountDialogOpen(true);
  };

  const updateAmount = async (e) => {
    e.preventDefault();
    if (!editingTicket) return;
    setUpdatingAmount(true);
    try {
      await api.patch(`/business/${business.id}/queue/${editingTicket.id}/amount`, {
        service_price: Number(editAmount) || 0,
      });
      toast.success("Amount updated");
      setAmountDialogOpen(false);
      setEditingTicket(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setUpdatingAmount(false);
    }
  };

  const openPaymentDialog = (ticket) => {
    setPaymentTicket(ticket);
    setPaymentMethod(ticket.payment_method || "");
    setPaymentDialogOpen(true);
  };

  const markAsPaid = async (e) => {
    e.preventDefault();
    if (!paymentTicket || !paymentMethod) return;
    setUpdatingPayment(true);
    try {
      await api.patch(`/business/${business.id}/queue/${paymentTicket.id}/paid`, {
        paid: true,
        payment_method: paymentMethod,
      });
      toast.success(`Marked as paid via ${paymentMethod}`);
      setPaymentDialogOpen(false);
      setPaymentTicket(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const markAsUnpaid = async (ticketId) => {
    try {
      await api.patch(`/business/${business.id}/queue/${ticketId}/paid`, {
        paid: false,
        payment_method: null,
      });
      toast.success("Marked as unpaid");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

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
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="collections" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-primary">Collections</p>
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
          <div className="mt-5 rounded-2xl border border-border bg-secondary px-5 py-4" data-testid="collections-upgrade-note">
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
            accent="text-primary"
            testid="collections-total"
          />
          <StatCard
            label="Paid"
            value={`₹${Number(totals.paid_amount || 0).toLocaleString("en-IN")}`}
            hint={`${totals.paid_count} tickets`}
            accent="text-success"
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="shortDate" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Collection"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--secondary))" }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
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
                <TableHead className="pr-5 text-right">Actions</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-900">
                          ₹{Number(row.service_price || 0).toLocaleString("en-IN")}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-stone-100"
                          onClick={() => openAmountDialog(row)}
                          data-testid={`edit-amount-${row.token_number}`}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-stone-500" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">
                      {row.payment_method === "online"
                        ? "Online"
                        : row.payment_method === "cash"
                          ? "Cash"
                          : "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.paid ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="rounded-full bg-success hover:bg-success/90 text-white"
                            onClick={() => markAsUnpaid(row.id)}
                            data-testid={`payment-status-${row.token_number}`}
                          >
                            <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                            Paid
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full border-primary/40 text-primary hover:bg-secondary"
                            onClick={() => openPaymentDialog(row)}
                            data-testid={`mark-paid-${row.token_number}`}
                          >
                            Mark as paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Amount Edit Dialog */}
        <Dialog open={amountDialogOpen} onOpenChange={setAmountDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif-display text-2xl">Update amount</DialogTitle>
              <DialogDescription>
                Change the service amount for this completed ticket.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={updateAmount} className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                Token <span className="font-medium text-stone-900">#{String(editingTicket?.token_number || "").padStart(3, "0")}</span>
                {" · "}
                <span className="font-medium text-stone-900">{editingTicket?.customer_name}</span>
              </div>
              <div>
                <Label>New amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1.5 h-11"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                  data-testid="edit-amount-input"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updatingAmount}
                  className="rounded-full bg-primary hover:bg-primary/90 text-white h-11 px-6"
                  data-testid="update-amount-submit"
                >
                  {updatingAmount ? "Updating…" : "Update amount"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Payment Method Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif-display text-2xl">Mark as paid</DialogTitle>
              <DialogDescription>
                Choose how this payment was received.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={markAsPaid} className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                Token <span className="font-medium text-stone-900">#{String(paymentTicket?.token_number || "").padStart(3, "0")}</span>
                {" · "}
                <span className="font-medium text-stone-900">{paymentTicket?.customer_name}</span>
                {" · "}
                <span className="font-medium text-stone-900">₹{Number(paymentTicket?.service_price || 0).toLocaleString("en-IN")}</span>
              </div>
              <div>
                <Label>Payment method</Label>
                <p className="mt-1 text-xs text-stone-500">
                  Choose how this payment came in.
                </p>
                <div className="mt-2">
                  <PaymentMethodCards
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    testidPrefix="collections-payment-method"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updatingPayment || !paymentMethod}
                  className="rounded-full bg-success hover:bg-success/90 text-white h-11 px-6"
                  data-testid="mark-paid-submit"
                >
                  {updatingPayment ? "Saving…" : "Confirm payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

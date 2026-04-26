import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Plus, UserPlus, Check, X, ChevronRight, Download, Copy, Tv, UserX, Printer, BadgeCheck,
} from "lucide-react";

function StatCard({ label, value, accent, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-[#2C302E]"}`}>{value}</p>
    </div>
  );
}

function statusStyle(status) {
  if (status === "serving") return "bg-[#7D9276]/15 text-[#4c6547] border-[#7D9276]/40";
  if (status === "waiting") return "bg-[#E3A587]/20 text-[#A86246] border-[#E3A587]/50";
  if (status === "completed") return "bg-stone-100 text-stone-600 border-stone-200";
  return "bg-red-50 text-red-600 border-red-100";
}

function serviceListForTicket(ticket) {
  if (Array.isArray(ticket.service_names) && ticket.service_names.length > 0) {
    return ticket.service_names.filter(Boolean);
  }
  if (ticket.service_name) {
    return ticket.service_name
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function paymentMethodLabel(method) {
  if (method === "online") return "Online";
  if (method === "cash") return "Cash";
  return null;
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
                ? "border-[#C47C5C] bg-[#F4EFE8]"
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

export default function Dashboard() {
  const { businessId } = useParams();
  const { auth, updateBusiness } = useAuth();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const [tickets, setTickets] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentMeta, setRecentMeta] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 });
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({ waiting: 0, serving: 0, completed_today: 0, no_show_today: 0, revenue_today: 0 });
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ customer_name: "", customer_phone: "", service_ids: [] });
  const [isOnline, setIsOnline] = useState(business?.is_online ?? true);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [ticketToComplete, setTicketToComplete] = useState(null);
  const [completion, setCompletion] = useState({ service_ids: [], final_amount: "0", payment_method: "", amountDirty: false });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState("");

  useEffect(() => {
    if (business) setIsOnline(!!business.is_online);
  }, [business]);

  const load = useCallback(async () => {
    if (!business) return;
    try {
      const [q, s, r, svc] = await Promise.all([
        api.get(`/business/${business.id}/queue`),
        api.get(`/business/${business.id}/stats`),
        api.get(`/business/${business.id}/recent-completed?page=${recentMeta.page}&page_size=${recentMeta.page_size}`),
        api.get(`/business/${business.id}/services`).catch(() => ({ data: [] })),
      ]);
      setTickets(q.data);
      setStats(s.data);
      setRecent(r.data.items || []);
      setRecentMeta((prev) => ({
        ...prev,
        page: r.data.page || prev.page,
        page_size: r.data.page_size || prev.page_size,
        total: r.data.total || 0,
        total_pages: r.data.total_pages || 1,
      }));
      setServices((svc.data || []).filter((item) => item.is_active !== false));
    } catch {
      /* ignore */
    }
  }, [business, recentMeta.page, recentMeta.page_size]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const waiting = useMemo(() => tickets.filter((t) => t.status === "waiting"), [tickets]);
  const serving = useMemo(() => tickets.filter((t) => t.status === "serving"), [tickets]);
  const suggestedTotal = useMemo(
    () => services
      .filter((svc) => completion.service_ids.includes(svc.id))
      .reduce((sum, svc) => sum + Number(svc.price || 0), 0),
    [completion.service_ids, services],
  );
  const walkInSelectedServices = useMemo(
    () => services.filter((svc) => walkIn.service_ids.includes(svc.id)),
    [services, walkIn.service_ids],
  );
  const walkInSelectedDuration = useMemo(
    () => walkInSelectedServices.reduce((sum, svc) => sum + Number(svc.duration_minutes || 0), 0),
    [walkInSelectedServices],
  );

  useEffect(() => {
    if (!completeOpen || completion.amountDirty) return;
    setCompletion((prev) => ({ ...prev, final_amount: String(suggestedTotal || 0) }));
  }, [completeOpen, completion.amountDirty, suggestedTotal]);

  if (auth === null) return null;
  if (!business) {
    if (businesses.length === 0) return <Navigate to="/dashboard/outlets" replace />;
    return <Navigate to={`/dashboard/${businesses[0].id}`} replace />;
  }

  const addWalkIn = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/business/${business.id}/queue/walk-in`, walkIn);
      toast.success(`Added ${walkIn.customer_name}`);
      setWalkIn({ customer_name: "", customer_phone: "", service_ids: [] });
      setWalkInOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const toggleWalkInService = (serviceId) => {
    setWalkIn((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter((id) => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }));
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/business/${business.id}/queue/${id}/status`, { status });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const togglePaid = async (id, paid) => {
    try {
      await api.patch(`/business/${business.id}/queue/${id}/paid`, { paid, payment_method: paid ? "cash" : null });
      toast.success(paid ? "Marked paid" : "Marked unpaid");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const callNext = async () => {
    try {
      await api.post(`/business/${business.id}/queue/call-next`);
      toast.success("Next guest is up");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const openCompleteDialog = (ticket) => {
    const selectedIds = (ticket.service_ids?.length
      ? ticket.service_ids
      : ticket.service_id
        ? [ticket.service_id]
        : []).filter((id) => id && services.some((svc) => svc.id === id));
    const baseAmount = ticket.service_price > 0
      ? Number(ticket.service_price)
      : services
        .filter((svc) => selectedIds.includes(svc.id))
        .reduce((sum, svc) => sum + Number(svc.price || 0), 0);
    setTicketToComplete(ticket);
    setCompletion({
      service_ids: selectedIds,
      final_amount: String(baseAmount || 0),
      payment_method: ticket.payment_method || "",
      amountDirty: false,
    });
    setCompleteOpen(true);
  };

  const toggleCompletionService = (serviceId) => {
    setCompletion((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter((id) => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }));
  };

  const submitCompletion = async (e) => {
    e.preventDefault();
    if (!ticketToComplete) return;
    setCompleting(true);
    try {
      await api.post(`/business/${business.id}/queue/${ticketToComplete.id}/complete`, {
        service_ids: completion.service_ids,
        final_amount: Number(completion.final_amount) || 0,
        paid: !!completion.payment_method,
        payment_method: completion.payment_method,
      });
      toast.success("Ticket completed");
      setCompleteOpen(false);
      setTicketToComplete(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setCompleting(false);
    }
  };

  const goToRecentPage = (page) => {
    setRecentMeta((prev) => ({
      ...prev,
      page: Math.max(1, Math.min(page, prev.total_pages || 1)),
    }));
  };

  const openPaymentDialog = (ticket) => {
    setPaymentTarget(ticket);
    setPaymentMethodChoice(ticket.payment_method || "");
    setPaymentOpen(true);
  };

  const submitPaymentMethod = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setPaymentSubmitting(true);
    try {
      await api.patch(`/business/${business.id}/queue/${paymentTarget.id}/paid`, {
        paid: true,
        payment_method: paymentMethodChoice,
      });
      toast.success(`Marked paid via ${paymentMethodChoice}`);
      setPaymentOpen(false);
      setPaymentTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const toggleOnline = async (v) => {
    setIsOnline(v);
    try {
      const { data } = await api.patch(`/business/${business.id}`, { is_online: v });
      updateBusiness(data);
      toast.success(v ? "Queue is open" : "Queue is paused");
    } catch (err) {
      setIsOnline(!v);
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const joinUrl = `${window.location.origin}/join/${business.id}`;
  const displayUrl = `${window.location.origin}/display/${business.id}`;

  const copy = (value, label) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const downloadQr = () => {
    const svg = document.querySelector("#qr-code svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${business.business_name}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <DashboardHeader activeTab="queue" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Live queue</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">{business.business_name}</h1>
            <p className="mt-2 text-stone-600 text-sm">
              {[business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2">
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-[#7D9276]" : "bg-stone-400"}`} />
              <span className="text-xs font-medium text-stone-700">{isOnline ? "Accepting guests" : "Paused"}</span>
              <Switch checked={isOnline} onCheckedChange={toggleOnline} data-testid="dashboard-online-toggle" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Waiting" value={stats.waiting} accent="text-[#A86246]" testid="stat-waiting" />
          <StatCard label="Serving" value={stats.serving} accent="text-[#4c6547]" testid="stat-serving" />
          <StatCard label="Done today" value={stats.completed_today} testid="stat-done" />
          <StatCard label="No-shows today" value={stats.no_show_today} testid="stat-noshow" />
          <StatCard label="Revenue today" value={`₹${Number(stats.revenue_today || 0).toLocaleString("en-IN")}`} accent="text-[#A86246]" testid="stat-revenue" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-stone-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="font-serif-display text-2xl leading-none">Live queue</h2>
                <p className="text-xs text-stone-500 mt-1">{waiting.length} waiting · {serving.length} in service</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-full border-stone-300" data-testid="add-walkin-btn">
                      <UserPlus className="h-4 w-4 mr-1.5" /> Walk-in
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif-display text-2xl">Add a walk-in</DialogTitle>
                      <DialogDescription>Assign them a token right from the front desk.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addWalkIn} className="space-y-4" data-testid="walkin-form">
                      <div>
                        <Label>Customer name</Label>
                        <Input required value={walkIn.customer_name}
                          onChange={(e) => setWalkIn({ ...walkIn, customer_name: e.target.value })}
                          className="mt-1.5 h-11" data-testid="walkin-name" />
                      </div>
                      <div>
                        <Label>Phone (optional)</Label>
                        <Input value={walkIn.customer_phone}
                          onChange={(e) => setWalkIn({ ...walkIn, customer_phone: e.target.value })}
                          className="mt-1.5 h-11" data-testid="walkin-phone" />
                      </div>
                      {services.length > 0 && (
                        <div>
                          <Label>Services requested</Label>
                          <p className="mt-1 text-xs text-stone-500">
                            Optional. Adding services helps wait times stay more accurate.
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {services.map((svc) => {
                              const checked = walkIn.service_ids.includes(svc.id);
                              return (
                                <label
                                  key={svc.id}
                                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                    checked
                                      ? "border-[#C47C5C]/50 bg-[#F4EFE8]"
                                      : "border-stone-200"
                                  }`}
                                >
                                  <span className="pt-0.5">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleWalkInService(svc.id)}
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-stone-900">{svc.name}</span>
                                    <span className="mt-0.5 block text-[11px] text-stone-500">
                                      {svc.duration_minutes} min
                                      {svc.price > 0 && ` · ₹${Number(svc.price).toLocaleString("en-IN")}`}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {walkInSelectedServices.length > 0 && (
                            <div className="mt-3 rounded-xl bg-[#F4EFE8] px-4 py-3 text-sm text-[#7A4C38]" data-testid="walkin-services-summary">
                              <span className="font-medium">
                                {walkInSelectedServices.length === 1
                                  ? walkInSelectedServices[0].name
                                  : `${walkInSelectedServices.length} services selected`}
                              </span>
                              <span className="ml-2 text-xs">
                                {walkInSelectedDuration > 0 && `~ ${walkInSelectedDuration} min`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <DialogFooter>
                        <Button type="submit" className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white h-11 px-6" data-testid="walkin-submit">
                          Add to queue
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button onClick={callNext}
                  className="rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white press"
                  disabled={waiting.length === 0 || serving.length >= business.total_chairs}
                  data-testid="call-next-btn">
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Call next
                </Button>
              </div>
            </div>

            <Dialog
              open={completeOpen}
              onOpenChange={(open) => {
                setCompleteOpen(open);
                if (!open) {
                  setTicketToComplete(null);
                  setCompleting(false);
                }
              }}
            >
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-serif-display text-2xl">Checkout</DialogTitle>
                  <DialogDescription>
                    Confirm the services provided, choose the payment method, and finish the checkout in one step.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitCompletion} className="space-y-5" data-testid="complete-ticket-form">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    Token <span className="font-medium text-stone-900">#{String(ticketToComplete?.token_number || "").padStart(3, "0")}</span>
                    {" · "}
                    <span className="font-medium text-stone-900">{ticketToComplete?.customer_name}</span>
                  </div>

                  {services.length > 0 && (
                    <div>
                      <Label>Services provided</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {services.map((svc) => {
                          const checked = completion.service_ids.includes(svc.id);
                          return (
                            <label
                              key={svc.id}
                              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                checked
                                  ? "border-[#C47C5C]/50 bg-[#F4EFE8]"
                                  : "border-stone-200"
                              }`}
                            >
                              <span className="pt-0.5">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleCompletionService(svc.id)}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-stone-900">{svc.name}</span>
                                <span className="mt-0.5 block text-[11px] text-stone-500">
                                  {svc.duration_minutes} min
                                  {" · "}
                                  {svc.price > 0 ? `₹${Number(svc.price).toLocaleString("en-IN")}` : "Free"}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Amount to pay</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="mt-1.5 h-11"
                        value={completion.final_amount}
                        onChange={(e) => setCompletion((prev) => ({
                          ...prev,
                          final_amount: e.target.value,
                          amountDirty: true,
                        }))}
                        data-testid="complete-ticket-amount"
                      />
                      <p className="mt-1 text-xs text-stone-500">
                        Suggested total: ₹{Number(suggestedTotal || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label>Paid by</Label>
                        <p className="mt-1 text-xs text-stone-500">
                          Optional. Choose a method now to complete this ticket as paid.
                        </p>
                        <div className="mt-2">
                          <PaymentMethodCards
                            value={completion.payment_method}
                            onChange={(value) => setCompletion((prev) => ({ ...prev, payment_method: value }))}
                            testidPrefix="complete-ticket-payment-method"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={completing}
                      className="rounded-full bg-[#7D9276] hover:bg-[#6a8064] text-white h-11 px-6"
                      data-testid="complete-ticket-submit"
                    >
                      {completing
                        ? "Finishing checkout…"
                        : completion.payment_method
                          ? "Complete & mark paid"
                          : "Complete without payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={paymentOpen}
              onOpenChange={(open) => {
                setPaymentOpen(open);
                if (!open) {
                  setPaymentTarget(null);
                  setPaymentSubmitting(false);
                }
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif-display text-2xl">Payment method</DialogTitle>
                  <DialogDescription>
                    Choose how this payment was received before marking the ticket paid.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitPaymentMethod} className="space-y-4" data-testid="payment-method-form">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    Token <span className="font-medium text-stone-900">#{String(paymentTarget?.token_number || "").padStart(3, "0")}</span>
                    {" · "}
                    <span className="font-medium text-stone-900">{paymentTarget?.customer_name}</span>
                  </div>
                  <div>
                    <Label>Paid by</Label>
                    <p className="mt-1 text-xs text-stone-500">
                      Choose how this payment came in.
                    </p>
                    <div className="mt-2">
                      <PaymentMethodCards
                        value={paymentMethodChoice}
                        onChange={setPaymentMethodChoice}
                        testidPrefix="payment-method-select"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={paymentSubmitting || !paymentMethodChoice}
                      className="rounded-full bg-[#7D9276] hover:bg-[#6a8064] text-white h-11 px-6"
                      data-testid="payment-method-submit"
                    >
                      {paymentSubmitting ? "Saving…" : "Confirm payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[90px]">Token</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center text-stone-500">
                      No one in the queue yet.
                    </TableCell>
                  </TableRow>
                )}
                {tickets.map((t) => (
                  <TableRow key={t.id} data-testid={`ticket-row-${t.token_number}`}>
                    <TableCell>
                      <span className="font-serif-display text-2xl">#{String(t.token_number).padStart(3, "0")}</span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{t.customer_name}</p>
                      {t.customer_phone && <p className="text-xs text-stone-500">{t.customer_phone}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-stone-600 capitalize">{t.booking_type}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-full border font-normal ${statusStyle(t.status)}`}>
                        {t.status === "serving" && t.chair_number
                          ? `Serving · ${business.station_label || "Station"} ${t.chair_number}`
                          : t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                    <div className="flex justify-end gap-2">
                        {t.status === "waiting" && (
                          <>
                            <Button size="sm" variant="outline" className="rounded-full border-stone-300"
                              onClick={() => updateStatus(t.id, "serving")}
                              disabled={serving.length >= business.total_chairs}
                              data-testid={`serve-${t.token_number}`}>
                              Start
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-full text-stone-500"
                              onClick={() => updateStatus(t.id, "no_show")}
                              title="Mark no-show"
                              data-testid={`noshow-${t.token_number}`}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {t.status === "serving" && (
                          <>
                            <Button size="sm"
                              className="rounded-full bg-[#7D9276] hover:bg-[#6a8064] text-white"
                              onClick={() => openCompleteDialog(t)}
                              data-testid={`complete-${t.token_number}`}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Checkout
                            </Button>
                          </>
                        )}
                        {t.status !== "completed" && t.status !== "cancelled" && t.status !== "no_show" && (
                          <Button size="sm" variant="ghost" className="rounded-full text-stone-500"
                            onClick={() => updateStatus(t.id, "cancelled")}
                            data-testid={`cancel-${t.token_number}`}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {recent.length > 0 && (
              <div className="mt-8 border-t border-stone-200 pt-6" data-testid="recent-completed">
                <div className="rounded-2xl border border-stone-200 bg-[#FCFBF9] p-5 sm:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="font-serif-display text-xl">Today&apos;s completions</h3>
                      <p className="mt-1 text-sm text-stone-500">Recent checkouts, payment status, and services provided.</p>
                    </div>
                    <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-stone-500">
                      Page {recentMeta.page} of {recentMeta.total_pages}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {recent.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-[0_1px_0_rgba(28,25,23,0.03)]"
                        data-testid={`recent-row-${t.token_number}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex items-start gap-3">
                            <div className="rounded-xl bg-[#F4EFE8] px-3 py-2 text-center">
                              <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Token</div>
                              <div className="font-serif-display text-xl leading-none text-[#A86246]">
                                #{String(t.token_number).padStart(3, "0")}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-stone-900">{t.customer_name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-stone-100 px-2.5 py-1">
                                  {t.service_count > 1 ? `${t.service_count} services` : t.service_name || "No service logged"}
                                </span>
                                {t.service_price > 0 && (
                                  <span className="rounded-full bg-[#F4EFE8] px-2.5 py-1 text-[#A86246]">
                                    ₹{Number(t.service_price).toLocaleString("en-IN")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {t.service_price > 0 ? (
                              t.paid ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="rounded-full bg-[#7D9276] hover:bg-[#6a8064] text-white"
                                  onClick={() => togglePaid(t.id, false)}
                                  data-testid={`recent-paid-toggle-${t.token_number}`}
                                >
                                  <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                                  Paid{paymentMethodLabel(t.payment_method) ? ` · ${paymentMethodLabel(t.payment_method)}` : ""}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full border-[#C47C5C]/40 text-[#A86246] hover:bg-[#F4EFE8]"
                                  onClick={() => openPaymentDialog(t)}
                                  data-testid={`recent-paid-toggle-${t.token_number}`}
                                >
                                  Mark paid
                                </Button>
                              )
                            ) : (
                              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-400">
                                Price not set
                              </span>
                            )}
                          </div>
                        </div>

                        {serviceListForTicket(t).length > 0 && (
                          <Accordion type="single" collapsible className="mt-3">
                            <AccordionItem value={`recent-${t.id}`} className="border-b-0">
                              <AccordionTrigger className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600 hover:no-underline">
                                View services provided
                              </AccordionTrigger>
                              <AccordionContent className="px-1 pb-1 pt-3">
                                <div className="flex flex-wrap gap-2">
                                  {serviceListForTicket(t).map((serviceName, index) => (
                                    <span
                                      key={`${t.id}-service-${index}`}
                                      className="rounded-full border border-stone-200 bg-[#FCFBF9] px-2.5 py-1 text-xs text-stone-700"
                                    >
                                      {serviceName}
                                    </span>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </div>
                    ))}
                  </div>
                  {recentMeta.total > 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
                      <p className="text-xs text-stone-500">
                        Showing {Math.min(((recentMeta.page - 1) * recentMeta.page_size) + 1, recentMeta.total)}
                        {" - "}
                        {Math.min(recentMeta.page * recentMeta.page_size, recentMeta.total)}
                        {" of "}
                        {recentMeta.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-stone-300"
                          onClick={() => goToRecentPage(recentMeta.page - 1)}
                          disabled={recentMeta.page <= 1}
                          data-testid="recent-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-stone-300"
                          onClick={() => goToRecentPage(recentMeta.page + 1)}
                          disabled={recentMeta.page >= recentMeta.total_pages}
                          data-testid="recent-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl">Customer join link</h3>
              <p className="mt-1 text-xs text-stone-500">Print the QR code or share the link.</p>
              <div id="qr-code" className="mt-4 flex items-center justify-center rounded-xl bg-[#F4EFE8] p-5">
                <QRCodeSVG value={joinUrl} size={150} bgColor="#F4EFE8" fgColor="#2C302E" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => copy(joinUrl, "Join link")} variant="outline" className="rounded-full border-stone-300 flex-1" data-testid="copy-join-link">
                  <Copy className="h-4 w-4 mr-1.5" /> Copy link
                </Button>
                <Button onClick={downloadQr} variant="outline" className="rounded-full border-stone-300 flex-1" data-testid="download-qr">
                  <Download className="h-4 w-4 mr-1.5" /> SVG
                </Button>
              </div>
              <Link
                to={`/dashboard/${business.id}/qr-poster`}
                target="_blank"
                rel="noreferrer"
                data-testid="open-qr-poster"
              >
                <Button variant="ghost" className="mt-2 w-full rounded-full text-[#A86246] hover:bg-[#F4EFE8]">
                  <Printer className="h-4 w-4 mr-1.5" /> Print poster for reception
                </Button>
              </Link>
              <p className="mt-3 text-[11px] break-all text-stone-500">{joinUrl}</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl flex items-center gap-2">
                <Tv className="h-4 w-4 text-[#A86246]" /> Public TV display
              </h3>
              <p className="mt-1 text-xs text-stone-500">Open this on a lobby screen to show who&apos;s being served now.</p>
              <div className="mt-3 flex gap-2">
                <Link to={`/display/${business.id}`} target="_blank" rel="noreferrer" className="flex-1" data-testid="open-display">
                  <Button variant="outline" className="w-full rounded-full border-stone-300">
                    <Tv className="h-4 w-4 mr-1.5" /> Open display
                  </Button>
                </Link>
                <Button onClick={() => copy(displayUrl, "Display link")}
                  variant="ghost" size="icon" className="rounded-full" data-testid="copy-display-link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-[11px] break-all text-stone-500">{displayUrl}</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl">Tips</h3>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> Use <strong>Call next</strong> to auto-assign the next free station.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> Mark waiting guests as no-show to keep analytics accurate.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> Open the TV display on a lobby screen for customers.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

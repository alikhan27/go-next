import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail, API } from "../lib/api";
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
  Plus, UserPlus, Check, X, ChevronRight, Download, Copy, Tv, UserX, Printer, BadgeCheck, Loader2,
} from "lucide-react";
import ConfirmDialog from "../components/common/ConfirmDialog";

function StatCard({ label, value, accent, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function statusStyle(status) {
  if (status === "serving") return "bg-success/15 text-success border-success/40";
  if (status === "waiting") return "bg-primary/20 text-primary border-primary/50";
  if (status === "completed") return "bg-stone-100 text-stone-600 border-stone-200";
  return "bg-red-50 text-red-600 border-red-100";
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

export default function Dashboard() {
  const { businessId } = useParams();
  const { auth, updateBusiness } = useAuth();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({ waiting: 0, serving: 0, completed_today: 0, no_show_today: 0, revenue_today: 0 });
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ customer_name: "", customer_phone: "", service_ids: [] });
  const [isOnline, setIsOnline] = useState(business?.is_online ?? true);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [ticketToComplete, setTicketToComplete] = useState(null);
  const [completion, setCompletion] = useState({ service_ids: [], final_amount: "0", payment_method: "", amountDirty: false });
  const [addingWalkIn, setAddingWalkIn] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [callingNext, setCallingNext] = useState(false);

  useEffect(() => {
    if (business) setIsOnline(!!business.is_online);
  }, [business]);

  useEffect(() => {
    if (!business) return;

    const eventSource = new EventSource(`${API}/business/${business.id}/queue/events`, { withCredentials: true });
    
    eventSource.onmessage = (event) => {
      try {
        if (!event.data) return;
        const tickets = JSON.parse(event.data);
        setTickets(tickets);
      } catch (e) {
        console.error("SSE JSON Parse Error:", e, "Data:", event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [business]);

  const load = useCallback(async () => {
    if (!business) return;
    try {
      const [s, svc] = await Promise.all([
        api.get(`/business/${business.id}/stats`),
        api.get(`/business/${business.id}/services`).catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setServices((svc.data || []).filter((item) => item.is_active !== false));
    } catch {
      /* ignore */
    }
  }, [business]);

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
    if (addingWalkIn) return;
    setAddingWalkIn(true);
    try {
      await api.post(`/business/${business.id}/queue/walk-in`, walkIn);
      setWalkIn({ customer_name: "", customer_phone: "", service_ids: [] });
      setWalkInOpen(false);
      await load();
      toast.success(`Added ${walkIn.customer_name} to queue`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setAddingWalkIn(false);
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
    if (updatingStatus[id]) return;
    setUpdatingStatus(prev => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/business/${business.id}/queue/${id}/status`, { status });
      await load();
      const statusLabels = {
        serving: "Started serving",
        no_show: "Marked as no-show",
        cancelled: "Cancelled ticket"
      };
      toast.success(statusLabels[status] || "Status updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const callNext = async () => {
    if (callingNext) return;
    setCallingNext(true);
    try {
      await api.post(`/business/${business.id}/queue/call-next`);
      await load();
      toast.success("Next guest is now serving");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setCallingNext(false);
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
      payment_method: ticket.payment_method ?? null, // Use null instead of ""
      amountDirty: false,
    });
    setCompleteOpen(true);
  };

  const toggleCompletionService = (serviceId) => {
    setCompletion((prev) => {
      const newServiceIds = prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter((id) => id !== serviceId)
        : [...prev.service_ids, serviceId];
      
      // If user hasn't manually edited the amount, update it based on selected services
      if (!prev.amountDirty) {
        const newTotal = services
          .filter((svc) => newServiceIds.includes(svc.id))
          .reduce((sum, svc) => sum + Number(svc.price || 0), 0);
        return {
          ...prev,
          service_ids: newServiceIds,
          final_amount: String(newTotal || 0),
        };
      }
      
      // User has manually edited amount, preserve it
      return {
        ...prev,
        service_ids: newServiceIds,
      };
    });
  };

  const submitCompletion = async (e) => {
    e.preventDefault();
    if (!ticketToComplete || completing) return;
    setCompleting(true);
    try {
      const finalAmount = Number(completion.final_amount) || 0;
      
      // Explicitly check if payment method is valid
      const hasPaymentMethod = completion.payment_method === "cash" || completion.payment_method === "online";
      const shouldBePaid = finalAmount > 0 && hasPaymentMethod;
      
      const payload = {
        service_ids: completion.service_ids,
        final_amount: finalAmount,
        paid: Boolean(shouldBePaid),
        payment_method: shouldBePaid ? completion.payment_method : null,
      };
      
      await api.post(`/business/${business.id}/queue/${ticketToComplete.id}/complete`, payload);
      setCompleteOpen(false);
      setTicketToComplete(null);
      await load();
      toast.success("Ticket completed successfully");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setCompleting(false);
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
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="queue" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-primary">Live queue</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">{business.business_name}</h1>
            <p className="mt-2 text-stone-600 text-sm">
              {[business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2">
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-success" : "bg-stone-400"}`} />
              <span className="text-xs font-medium text-stone-700">{isOnline ? "Accepting guests" : "Paused"}</span>
              <Switch checked={isOnline} onCheckedChange={toggleOnline} data-testid="dashboard-online-toggle" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Waiting" value={stats.waiting} accent="text-primary" testid="stat-waiting" />
          <StatCard label="Serving" value={stats.serving} accent="text-success" testid="stat-serving" />
          <StatCard label="Done today" value={stats.completed_today} testid="stat-done" />
          <StatCard label="No-shows today" value={stats.no_show_today} testid="stat-noshow" />
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
                                      ? "border-primary/50 bg-secondary"
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
                            <div className="mt-3 rounded-xl bg-secondary px-4 py-3 text-sm text-primary" data-testid="walkin-services-summary">
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
                        <Button 
                          type="submit" 
                          disabled={addingWalkIn}
                          className="rounded-full bg-foreground hover:bg-foreground/90 text-white h-11 px-6" 
                          data-testid="walkin-submit"
                        >
                          {addingWalkIn ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add to queue"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={callNext}
                  className="rounded-full bg-primary hover:bg-primary/90 text-white press"
                  disabled={callingNext || waiting.length === 0 || serving.length >= business.total_chairs}
                  data-testid="call-next-btn"
                >
                  {callingNext ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Calling...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Call next
                    </>
                  )}
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
                  setCompletion({ service_ids: [], final_amount: "0", payment_method: "", amountDirty: false });
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
                                  ? "border-primary/50 bg-secondary"
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
                    {Number(completion.final_amount) > 0 && (
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
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={completing}
                      className="rounded-full bg-success hover:bg-success/90 text-white h-11 px-6"
                      data-testid="complete-ticket-submit"
                    >
                      {(() => {
                        if (completing) {
                          return "Finishing checkout…";
                        }
                        const amount = Number(completion.final_amount) || 0;
                        if (amount === 0) {
                          return "Complete (Unpaid)";
                        }
                        if (completion.payment_method) {
                          return "Complete & mark paid";
                        }
                        return "Complete (Unpaid)";
                      })()}
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
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="rounded-full border-stone-300"
                              onClick={() => updateStatus(t.id, "serving")}
                              disabled={updatingStatus[t.id] || serving.length >= business.total_chairs}
                              data-testid={`serve-${t.token_number}`}
                            >
                              {updatingStatus[t.id] ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                "Start"
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="rounded-full text-stone-500"
                              onClick={() => updateStatus(t.id, "no_show")}
                              disabled={updatingStatus[t.id]}
                              title="Mark no-show"
                              data-testid={`noshow-${t.token_number}`}
                            >
                              {updatingStatus[t.id] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserX className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                        {t.status === "serving" && (
                          <>
                            <Button size="sm"
                              className="rounded-full bg-success hover:bg-success/90 text-white"
                              onClick={() => openCompleteDialog(t)}
                              data-testid={`complete-${t.token_number}`}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Checkout
                            </Button>
                          </>
                        )}
                        {t.status !== "completed" && t.status !== "cancelled" && t.status !== "no_show" && (
                          <ConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full text-stone-500"
                                disabled={updatingStatus[t.id]}
                                data-testid={`cancel-${t.token_number}`}
                              >
                                {updatingStatus[t.id] ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            }
                            title={`Cancel ticket #${t.token_number}?`}
                            description={`This will cancel ${t.customer_name || "the ticket"} and remove them from the queue. This can't be undone.`}
                            confirmLabel="Cancel ticket"
                            cancelLabel="Keep ticket"
                            onConfirm={() => updateStatus(t.id, "cancelled")}
                            testidPrefix={`cancel-ticket-${t.token_number}`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl">Customer join link</h3>
              <p className="mt-1 text-xs text-stone-500">Print the QR code or share the link.</p>
              <div id="qr-code" className="mt-4 flex items-center justify-center rounded-xl bg-secondary p-5">
                <QRCodeSVG value={joinUrl} size={150} bgColor="hsl(var(--secondary))" fgColor="hsl(var(--foreground))" />
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
                <Button variant="ghost" className="mt-2 w-full rounded-full text-primary hover:bg-secondary">
                  <Printer className="h-4 w-4 mr-1.5" /> Print poster for reception
                </Button>
              </Link>
              <p className="mt-3 text-[11px] break-all text-stone-500">{joinUrl}</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl flex items-center gap-2">
                <Tv className="h-4 w-4 text-primary" /> Public TV display
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
                <li className="flex gap-2"><Plus className="h-4 w-4 text-primary flex-none mt-0.5" /> Use <strong>Call next</strong> to auto-assign the next free station.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-primary flex-none mt-0.5" /> Mark waiting guests as no-show to keep analytics accurate.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-primary flex-none mt-0.5" /> Open the TV display on a lobby screen for customers.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

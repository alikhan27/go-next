import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Plus, UserPlus, Check, X, ChevronRight, Settings as SettingsIcon, Download, Copy,
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

export default function Dashboard() {
  const { auth, refresh } = useAuth();
  const business = auth?.business;
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ waiting: 0, serving: 0, completed_today: 0, cancelled_today: 0 });
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkIn, setWalkIn] = useState({ customer_name: "", customer_phone: "" });
  const [isOnline, setIsOnline] = useState(business?.is_online ?? true);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (business) setIsOnline(!!business.is_online);
  }, [business]);

  const load = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([
        api.get("/queue/manage"),
        api.get("/queue/manage/stats"),
      ]);
      setTickets(q.data);
      setStats(s.data);
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const waiting = useMemo(() => tickets.filter((t) => t.status === "waiting"), [tickets]);
  const serving = useMemo(() => tickets.filter((t) => t.status === "serving"), [tickets]);

  const addWalkIn = async (e) => {
    e.preventDefault();
    try {
      await api.post("/queue/manage/walk-in", walkIn);
      toast.success(`Added ${walkIn.customer_name}`);
      setWalkIn({ customer_name: "", customer_phone: "" });
      setWalkInOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/queue/manage/${id}/status`, { status });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const callNext = async () => {
    try {
      await api.post("/queue/manage/call-next");
      toast.success("Next guest is up");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const toggleOnline = async (v) => {
    setIsOnline(v);
    try {
      await api.patch("/business/me", { is_online: v });
      await refresh();
      toast.success(v ? "Queue is open" : "Queue is paused");
    } catch (err) {
      setIsOnline(!v);
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const joinUrl = business ? `${window.location.origin}/join/${business.id}` : "";

  const copyJoinUrl = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    toast.success("Join link copied");
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
    a.download = `${business?.business_name || "queue"}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!business) {
    return (
      <div className="min-h-screen bg-[#F9F8F6]">
        <Navbar />
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h1 className="font-serif-display text-3xl">We couldn&apos;t find a business for your account.</h1>
          <p className="mt-3 text-stone-600">Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Dashboard</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">{business.business_name}</h1>
            <p className="mt-2 text-stone-600 text-sm">{business.address}{business.city ? `, ${business.city}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2">
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-[#7D9276]" : "bg-stone-400"}`} />
              <span className="text-xs font-medium text-stone-700">{isOnline ? "Accepting guests" : "Paused"}</span>
              <Switch checked={isOnline} onCheckedChange={toggleOnline} data-testid="dashboard-online-toggle" />
            </div>
            <Link to="/dashboard/settings" data-testid="dashboard-settings-btn">
              <Button variant="outline" className="rounded-full border-stone-300"><SettingsIcon className="h-4 w-4 mr-1.5" />Settings</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Waiting" value={stats.waiting} accent="text-[#A86246]" testid="stat-waiting" />
          <StatCard label="Serving" value={stats.serving} accent="text-[#4c6547]" testid="stat-serving" />
          <StatCard label="Done today" value={stats.completed_today} testid="stat-done" />
          <StatCard label="Stations" value={business.total_chairs} testid="stat-chairs" />
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
                        {t.status === "serving" && t.chair_number ? `Serving · ${business.station_label || "Station"} ${t.chair_number}` : t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="flex justify-end gap-2">
                        {t.status === "waiting" && (
                          <Button size="sm" variant="outline" className="rounded-full border-stone-300"
                            onClick={() => updateStatus(t.id, "serving")}
                            disabled={serving.length >= business.total_chairs}
                            data-testid={`serve-${t.token_number}`}>
                            Start
                          </Button>
                        )}
                        {t.status === "serving" && (
                          <Button size="sm"
                            className="rounded-full bg-[#7D9276] hover:bg-[#6a8064] text-white"
                            onClick={() => updateStatus(t.id, "completed")}
                            data-testid={`complete-${t.token_number}`}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Done
                          </Button>
                        )}
                        {t.status !== "completed" && t.status !== "cancelled" && (
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
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl">Customer join link</h3>
              <p className="mt-1 text-xs text-stone-500">Print the QR code or share the link.</p>
              <div id="qr-code" className="mt-4 flex items-center justify-center rounded-xl bg-[#F4EFE8] p-5">
                <QRCodeSVG value={joinUrl} size={150} bgColor="#F4EFE8" fgColor="#2C302E" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={copyJoinUrl} variant="outline" className="rounded-full border-stone-300 flex-1" data-testid="copy-join-link">
                  <Copy className="h-4 w-4 mr-1.5" /> Copy link
                </Button>
                <Button onClick={downloadQr} variant="outline" className="rounded-full border-stone-300 flex-1" data-testid="download-qr">
                  <Download className="h-4 w-4 mr-1.5" /> SVG
                </Button>
              </div>
              <p className="mt-3 text-[11px] break-all text-stone-500">{joinUrl}</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h3 className="font-serif-display text-xl">Tips</h3>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> Use <strong>Call next</strong> to auto-assign the next free station.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> Pause the queue after last call; unpause next morning.</li>
                <li className="flex gap-2"><Plus className="h-4 w-4 text-[#C47C5C] flex-none mt-0.5" /> The customer link is permanent — reprint only when you rename the salon.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

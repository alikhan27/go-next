import { useMemo, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  Check, ChevronRight, Building2, QrCode, Tv, Sparkles, Copy, Printer,
} from "lucide-react";

/**
 * 4-step onboarding wizard for first-time owners. Reached right after
 * registration (Register.jsx redirects here) or manually from the
 * dashboard ("Run setup again" link). Uses localStorage to remember
 * the owner has finished it for this outlet.
 */

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "stations", title: "Stations", icon: Building2 },
  { id: "qr", title: "Share QR", icon: QrCode },
  { id: "display", title: "TV display", icon: Tv },
];

function onboardingKey(userId) {
  return `gonext:onboarded:${userId || "anon"}`;
}

export function markOnboardingDone(userId) {
  try {
    localStorage.setItem(onboardingKey(userId), "1");
  } catch {
    /* private-mode safe */
  }
}

export function hasCompletedOnboarding(userId) {
  try {
    return localStorage.getItem(onboardingKey(userId)) === "1";
  } catch {
    return false;
  }
}

export default function Onboarding() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { auth, updateBusiness } = useAuth();
  const { planLimits, planLabel } = usePlans();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);

  const [step, setStep] = useState(0);
  const [stations, setStations] = useState(business?.total_chairs || 1);
  const [saving, setSaving] = useState(false);

  const maxStations = planLimits(auth?.user).max_stations;
  const joinUrl = useMemo(
    () => (business ? `${window.location.origin}/join/${business.id}` : ""),
    [business],
  );
  const displayUrl = useMemo(
    () => (business ? `${window.location.origin}/display/${business.id}` : ""),
    [business],
  );

  if (auth === null) return null;
  if (!auth || auth === false) return <Navigate to="/login" replace />;
  if (!business) return <Navigate to="/dashboard" replace />;

  const copy = (value, label) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const saveStations = async () => {
    if (stations === business.total_chairs) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/business/${business.id}`, {
        total_chairs: Number(stations),
      });
      updateBusiness(data);
      toast.success(`Saved · ${data.total_chairs} station${data.total_chairs === 1 ? "" : "s"}`);
      setStep(2);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    markOnboardingDone(auth.user?.id);
    toast.success("You're all set");
    navigate(`/dashboard/${business.id}`);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6]" data-testid="onboarding-page">
      <main className="mx-auto max-w-3xl px-5 py-12">
        {/* Brand strip */}
        <Link to="/" className="inline-flex items-center gap-2" data-testid="onboarding-brand">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display">g</div>
          <span className="text-sm font-semibold">Go-Next</span>
        </Link>

        {/* Step indicator */}
        <nav className="mt-8 flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => {
            const Active = s.icon;
            const done = i < step;
            const current = i === step;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  current
                    ? "bg-[#2C302E] text-white"
                    : done
                      ? "bg-[#7D9276]/20 text-[#4c6547]"
                      : "bg-stone-100 text-stone-500"
                }`}
                data-testid={`onboarding-step-${s.id}${current ? "-current" : ""}`}
              >
                {done ? <Check className="h-3 w-3" /> : <Active className="h-3 w-3" />}
                <span>{s.title}</span>
              </div>
            );
          })}
        </nav>

        {/* Step body */}
        <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          {step === 0 && (
            <div data-testid="onboarding-welcome">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">
                Welcome to Go-Next
              </p>
              <h1 className="font-serif-display text-4xl sm:text-5xl mt-3 leading-tight">
                Hi {auth.user?.name?.split(" ")[0] || "there"} — let&apos;s get&nbsp;
                <span className="text-[#A86246]">{business.business_name}</span>&nbsp;live.
              </h1>
              <p className="mt-4 text-stone-600 max-w-xl">
                Three quick steps: tell us how many stations you have, grab your customer QR, and
                open the lobby TV display. You can change any of this later from Settings.
              </p>
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={finish}
                  className="text-sm text-stone-500 hover:text-stone-900 underline underline-offset-4"
                  data-testid="onboarding-skip"
                >
                  Skip for now
                </button>
                <Button
                  onClick={() => setStep(1)}
                  className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press h-11 px-6"
                  data-testid="onboarding-welcome-next"
                >
                  Let&apos;s go <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div data-testid="onboarding-stations">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Step 2 · Stations</p>
              <h2 className="font-serif-display text-3xl sm:text-4xl mt-3">How many chairs or stations?</h2>
              <p className="mt-3 text-stone-600">
                This is how many customers can be served at once. You&apos;re on the{" "}
                <strong>{planLabel(auth?.user)}</strong> plan —
                up to <strong>{maxStations}</strong> station{maxStations === 1 ? "" : "s"}.
              </p>
              <div className="mt-8 max-w-xs">
                <Label htmlFor="stations-input">Stations</Label>
                <Input
                  id="stations-input"
                  type="number"
                  min={1}
                  max={maxStations}
                  value={stations}
                  onChange={(e) => setStations(Math.max(1, Math.min(maxStations, Number(e.target.value) || 1)))}
                  className="mt-1.5 h-12 text-2xl font-serif-display"
                  data-testid="onboarding-stations-input"
                />
              </div>
              <div className="mt-10 flex items-center justify-between">
                <button
                  onClick={() => setStep(0)}
                  className="text-sm text-stone-500 hover:text-stone-900"
                  data-testid="onboarding-stations-back"
                >
                  ← Back
                </button>
                <Button
                  onClick={saveStations}
                  disabled={saving}
                  className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press h-11 px-6"
                  data-testid="onboarding-stations-next"
                >
                  {saving ? "Saving…" : "Continue"} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div data-testid="onboarding-qr">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Step 3 · Customer QR</p>
              <h2 className="font-serif-display text-3xl sm:text-4xl mt-3">Print this for your reception desk.</h2>
              <p className="mt-3 text-stone-600">
                Customers scan the QR to join the queue from their own phone — no download needed.
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-[220px_1fr] items-center">
                <div className="rounded-2xl bg-[#F4EFE8] p-5 border border-[#E3D9C8] flex items-center justify-center">
                  <QRCodeSVG value={joinUrl} size={180} bgColor="#F4EFE8" fgColor="#2C302E" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Join link</p>
                  <p className="mt-1 break-all text-sm text-stone-700">{joinUrl}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full border-stone-300"
                      onClick={() => copy(joinUrl, "Join link")}
                      data-testid="onboarding-copy-link"
                    >
                      <Copy className="h-4 w-4 mr-1.5" /> Copy link
                    </Button>
                    <Link
                      to={`/dashboard/${business.id}/qr-poster`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="onboarding-open-poster"
                    >
                      <Button variant="outline" className="rounded-full border-stone-300">
                        <Printer className="h-4 w-4 mr-1.5" /> Open print poster
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-stone-500 hover:text-stone-900"
                  data-testid="onboarding-qr-back"
                >
                  ← Back
                </button>
                <Button
                  onClick={() => setStep(3)}
                  className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press h-11 px-6"
                  data-testid="onboarding-qr-next"
                >
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div data-testid="onboarding-display">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Step 4 · Lobby TV</p>
              <h2 className="font-serif-display text-3xl sm:text-4xl mt-3">Open the &ldquo;Now Serving&rdquo; screen.</h2>
              <p className="mt-3 text-stone-600">
                Paste this link into a browser on your lobby TV or tablet. It auto-refreshes in real time.
              </p>

              <div className="mt-6 rounded-2xl border border-stone-200 bg-[#F9F8F6] p-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-stone-700 break-all">{displayUrl}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full border-stone-300"
                    onClick={() => copy(displayUrl, "Display link")}
                    data-testid="onboarding-copy-display"
                  >
                    <Copy className="h-4 w-4 mr-1.5" /> Copy
                  </Button>
                  <Link
                    to={`/display/${business.id}`}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="onboarding-open-display"
                  >
                    <Button className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white">
                      <Tv className="h-4 w-4 mr-1.5" /> Open display
                    </Button>
                  </Link>
                </div>
              </div>

              <ul className="mt-8 space-y-2 text-sm text-stone-600">
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#7D9276] flex-none mt-0.5" /> Live queue with customer names and tokens</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#7D9276] flex-none mt-0.5" /> Refreshes every 3 seconds</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#7D9276] flex-none mt-0.5" /> Works on any browser — no login needed</li>
              </ul>

              <div className="mt-10 flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="text-sm text-stone-500 hover:text-stone-900"
                  data-testid="onboarding-display-back"
                >
                  ← Back
                </button>
                <Button
                  onClick={finish}
                  className="rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white press h-11 px-6"
                  data-testid="onboarding-finish"
                >
                  <Check className="h-4 w-4 mr-1.5" /> Finish setup
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

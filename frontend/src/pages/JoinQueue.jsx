import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { MapPin, Users, Clock } from "lucide-react";

export default function JoinQueue() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/public/business/${businessId}/queue-summary`);
      setSummary(data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const existing = localStorage.getItem(`ticket-${businessId}`);
    if (!existing) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/public/ticket/${existing}`);
        const status = data?.ticket?.status;
        if (cancelled) return;
        if (status === "waiting" || status === "serving") {
          navigate(`/ticket/${existing}`, { replace: true });
        } else {
          // terminal or unknown status — stale pointer, drop it and show the form
          localStorage.removeItem(`ticket-${businessId}`);
        }
      } catch {
        // ticket no longer exists; clear and show the form
        localStorage.removeItem(`ticket-${businessId}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/public/business/${businessId}/join`, form);
      localStorage.setItem(`ticket-${businessId}`, data.id);
      toast.success("You're in the queue");
      navigate(`/ticket/${data.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] text-stone-500">Loading…</div>;
  }

  if (notFound || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] px-5">
        <div className="text-center max-w-sm">
          <h1 className="font-serif-display text-4xl">We couldn&apos;t find this salon.</h1>
          <p className="mt-2 text-stone-600 text-sm">The join link may have changed.</p>
        </div>
      </div>
    );
  }

  const { business, waiting_count, serving_count, total_chairs } = summary;
  const availableChairs = Math.max(total_chairs - serving_count, 0);
  const estimate = waiting_count <= availableChairs ? 0 : Math.round(((waiting_count - availableChairs) / Math.max(total_chairs, 1)) * 15);

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C302E]">
      <div className="warm-hero-gradient grain">
        <div className="mx-auto max-w-md px-5 pt-12 pb-10">
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Join the queue</p>
          <h1 className="font-serif-display mt-3 text-4xl sm:text-5xl leading-none">{business.business_name}</h1>
          {business.address && (
            <p className="mt-2 text-sm text-stone-600 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {business.address}{business.city ? `, ${business.city}` : ""}
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Waiting</p>
              <p className="font-serif-display text-2xl text-[#A86246]">{waiting_count}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Serving</p>
              <p className="font-serif-display text-2xl text-[#4c6547]">{serving_count}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">~ Wait</p>
              <p className="font-serif-display text-2xl">{estimate}m</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 -mt-4 pb-16">
        {!business.is_online ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
            <p className="font-serif-display text-2xl">Queue is paused</p>
            <p className="mt-2 text-sm text-stone-600">
              {business.business_name} is not accepting new guests at the moment. Please check back soon.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4" data-testid="join-form">
            <div>
              <Label>Your name</Label>
              <Input required className="mt-1.5 h-12" placeholder="e.g. Priya"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                data-testid="join-name" />
            </div>
            <div>
              <Label>Mobile number</Label>
              <Input required className="mt-1.5 h-12" placeholder="So we can call you if needed"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                data-testid="join-phone" />
            </div>
            <Button type="submit" disabled={submitting}
              className="w-full h-12 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
              data-testid="join-submit">
              {submitting ? "Getting your token…" : "Get my token"}
            </Button>
            <p className="text-[11px] text-stone-500 flex items-center gap-1.5 justify-center">
              <Clock className="h-3 w-3" /> You&apos;ll see a live status once you&apos;re in.
            </p>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-500">
          <Users className="h-3.5 w-3.5" />
          <span>{total_chairs} {total_chairs === 1 ? "station" : "stations"} available on site</span>
        </div>
      </div>
    </div>
  );
}

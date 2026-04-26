import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Check, MapPin, Users, Clock, Sparkles } from "lucide-react";

export default function JoinQueue() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", service_ids: [] });
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, svc] = await Promise.all([
        api.get(`/public/business/${businessId}/queue-summary`),
        api.get(`/public/business/${businessId}/services`).catch(() => ({ data: [] })),
      ]);
      setSummary(s.data);
      setServices(svc.data || []);
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
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
      };
      if (form.service_ids.length > 0) payload.service_ids = form.service_ids;
      const { data } = await api.post(`/public/business/${businessId}/join`, payload);
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

  const { business, waiting_count, serving_count, total_chairs, estimated_wait_minutes } = summary;
  const selectedServices = services.filter((s) => form.service_ids.includes(s.id));
  const selectedDuration = selectedServices.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0);
  const selectedPrice = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const toggleService = (serviceId) => {
    setForm((prev) => {
      const active = prev.service_ids.includes(serviceId);
      return {
        ...prev,
        service_ids: active
          ? prev.service_ids.filter((id) => id !== serviceId)
          : [...prev.service_ids, serviceId],
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C302E]">
      <div className="warm-hero-gradient grain">
        <div className="mx-auto max-w-md px-5 pt-12 pb-10">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-stone-200/80 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display text-lg">
                g
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Queue by</p>
                <p className="text-sm font-semibold leading-none text-[#2C302E]">Go-Next</p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.26em] text-[#A86246] text-center">Join the queue</p>
          <h1 className="font-serif-display mt-3 text-4xl sm:text-5xl leading-none text-center">{business.business_name}</h1>
          {business.address && (
            <p className="mt-2 text-sm text-stone-600 flex items-center justify-center gap-1.5 text-center">
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
              <p className="font-serif-display text-2xl">{estimated_wait_minutes ?? 0}m</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 -mt-4 pb-16">
        {!business.is_online ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center" data-testid="join-paused">
            <p className="font-serif-display text-2xl">Queue is paused</p>
            {business.offline_message ? (
              <p className="mt-3 text-sm text-stone-700 whitespace-pre-line" data-testid="join-offline-message">
                {business.offline_message}
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                {business.business_name} is not accepting new guests at the moment. Please check back soon.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-6 space-y-5" data-testid="join-form">
            {services.length > 0 && (
              <div data-testid="join-services">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#C47C5C]" />
                  Pick services
                </Label>
                <p className="mt-1 text-xs text-stone-500">Optional. Choose any that apply and we&apos;ll add up the time to estimate your wait.</p>
                <div className="mt-3 grid gap-2">
                  {services.map((s) => {
                    const active = form.service_ids.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleService(s.id)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                          active
                            ? "border-[#C47C5C] bg-[#F4EFE8] text-[#A86246]"
                            : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                        data-testid={`join-service-${s.id}`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            active
                              ? "border-[#C47C5C] bg-[#C47C5C] text-white"
                              : "border-stone-300 text-transparent"
                          }`}>
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium truncate">{s.name}</span>
                        </span>
                        <span className={`flex items-center gap-3 text-xs ${active ? "text-[#A86246]" : "text-stone-500"}`}>
                          <span>~ {s.duration_minutes} min</span>
                          {s.price > 0 && (
                            <span className={`font-medium ${active ? "text-[#A86246]" : "text-stone-700"}`}>
                              ₹{Number(s.price).toLocaleString("en-IN")}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="mt-3 rounded-xl bg-[#F4EFE8] px-4 py-3 text-sm text-[#7A4C38]" data-testid="join-services-summary">
                    <span className="font-medium">
                      {selectedServices.length === 1
                        ? selectedServices[0].name
                        : `${selectedServices.length} services selected`}
                    </span>
                    <span className="ml-2 text-xs">
                      {selectedDuration > 0 && `~ ${selectedDuration} min`}
                      {selectedPrice > 0 && ` · ₹${selectedPrice.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                )}
              </div>
            )}

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
              className="w-full h-12 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press disabled:opacity-50"
              data-testid="join-submit">
              {submitting
                ? "Getting your token…"
                : selectedServices.length > 0
                  ? `Get my token · ${selectedServices.length === 1 ? selectedServices[0].name : `${selectedServices.length} services`}`
                  : "Get my token"}
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

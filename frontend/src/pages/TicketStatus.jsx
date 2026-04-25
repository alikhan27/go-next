import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { CheckCircle2, XCircle, Clock, MapPin, Sparkles } from "lucide-react";

export default function TicketStatus() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/public/ticket/${ticketId}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't fetch ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  // When the ticket reaches a terminal state, clear the localStorage pointer
  // so the customer is not bounced back here from /join/:businessId.
  useEffect(() => {
    const t = data?.ticket;
    if (!t) return;
    if (t.status === "completed" || t.status === "cancelled" || t.status === "no_show") {
      try {
        localStorage.removeItem(`ticket-${t.business_id}`);
      } catch {
        /* ignore */
      }
    }
  }, [data]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] text-stone-500">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] px-5 text-center">
        <div className="max-w-sm">
          <h1 className="font-serif-display text-3xl">We couldn&apos;t find that ticket.</h1>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline" className="rounded-full border-stone-300" data-testid="ticket-back-home">Back to home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { ticket, position, estimated_wait_minutes, business } = data;

  const Hero = () => {
    if (ticket.status === "completed") {
      return (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#7D9276]" />
          <h2 className="font-serif-display text-4xl mt-4">All done.</h2>
          <p className="mt-2 text-stone-600">Thank you for visiting {business?.business_name}.</p>
          {ticket.paid && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#7D9276]/15 text-[#4c6547] border border-[#7D9276]/30 px-3 py-1 text-[11px] uppercase tracking-[0.22em]" data-testid="ticket-paid-badge">
              <CheckCircle2 className="h-3 w-3" /> Paid
            </div>
          )}
        </div>
      );
    }
    if (ticket.status === "cancelled") {
      return (
        <div className="text-center py-6">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="font-serif-display text-4xl mt-4">Ticket cancelled.</h2>
          <p className="mt-2 text-stone-600">Please join again if you&apos;d still like to be served.</p>
        </div>
      );
    }
    if (ticket.status === "serving") {
      return (
        <div className="text-center py-6">
          <Sparkles className="mx-auto h-10 w-10 text-[#C47C5C]" />
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246] mt-4">It&apos;s your turn</p>
          <h2 className="font-serif-display text-5xl mt-2">Please head to {business?.station_label || "Station"} {ticket.chair_number}</h2>
        </div>
      );
    }
    return (
      <div className="text-center py-6">
        <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">You&apos;re in the queue</p>
        <p className="font-serif-display text-7xl mt-4 leading-none" data-testid="ticket-position">
          {position === 1 ? "You're next" : `#${position}`}
        </p>
        <p className="mt-3 text-stone-600 text-sm">
          {position === 1 ? "Stay close — any moment now." : `${position - 1} ahead of you`}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C302E]">
      <div className="warm-hero-gradient grain">
        <div className="mx-auto max-w-md px-5 pt-10 pb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">{business?.business_name}</p>
          <p className="mt-1 text-xs text-stone-600">
            Token · <span className="font-medium">#{String(ticket.token_number).padStart(3, "0")}</span>
          </p>
          {business?.address && (
            <p className="mt-1 text-xs text-stone-500 inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {business.address}{business.city ? `, ${business.city}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 -mt-2 pb-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <Hero />

          {ticket.status === "waiting" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F4EFE8] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Approx wait</p>
                <p className="font-serif-display text-2xl mt-1">{estimated_wait_minutes}m</p>
              </div>
              <div className="rounded-2xl bg-[#F4EFE8] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Your name</p>
                <p className="font-serif-display text-2xl mt-1 truncate">{ticket.customer_name}</p>
              </div>
            </div>
          )}

          {(ticket.service_name || ticket.service_price > 0) && (
            <div className="mt-4 rounded-2xl border border-stone-200 px-4 py-3 flex items-center justify-between" data-testid="ticket-service-row">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Service</p>
                <p className="font-medium truncate">{ticket.service_name || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Total</p>
                <p className="font-serif-display text-2xl text-[#A86246]" data-testid="ticket-total">
                  {ticket.service_price > 0 ? `₹${Number(ticket.service_price).toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-stone-500 inline-flex w-full items-center justify-center gap-1.5">
            <Clock className="h-3 w-3" /> Live status updates every few seconds.
          </div>
        </div>

        {(ticket.status === "completed" || ticket.status === "cancelled" || ticket.status === "no_show") && (
          <Button
            onClick={() => {
              try { localStorage.removeItem(`ticket-${ticket.business_id}`); } catch { /* ignore */ }
              navigate(`/join/${ticket.business_id}`);
            }}
            className="mt-4 w-full h-12 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
            data-testid="ticket-rejoin"
          >
            Join the queue again
          </Button>
        )}
      </div>
    </div>
  );
}

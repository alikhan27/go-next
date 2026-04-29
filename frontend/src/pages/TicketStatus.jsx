import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, API } from "../lib/api";
import { Button } from "../components/ui/button";
import { CheckCircle2, XCircle, Clock, MapPin, Sparkles } from "lucide-react";
import { LogoMark } from "../components/LogoMark";

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
  }, [load]);

  // SSE for instant updates
  useEffect(() => {
    if (!ticketId) return;

    const eventSource = new EventSource(`${API}/public/ticket/${ticketId}/events`, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        if (!event.data) return;
        const payload = JSON.parse(event.data);
        setData(payload);
        setError(null);
        setLoading(false);
      } catch (e) {
        console.error("SSE JSON Parse Error:", e, "Data:", event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      // Fallback to polling if SSE fails
    };

    return () => {
      eventSource.close();
    };
  }, [ticketId]);

  // Polling fallback (runs alongside SSE but only actually updates state if data is different)
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // When the ticket reaches a terminal state, clear the storage pointers
  // so the customer is not bounced back here from /join/:businessId.
  useEffect(() => {
    const t = data?.ticket;
    if (!t) return;
    if (t.status === "completed" || t.status === "cancelled" || t.status === "no_show") {
      try {
        localStorage.removeItem(`ticket-${t.business_id}`);
        sessionStorage.removeItem(`ticket-${t.business_id}`);
      } catch {
        /* ignore */
      }
    }
  }, [data]);

  if (loading && !data) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-stone-500">Loading…</div>;
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5 text-center">
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

  if (!data) return null;

  const { ticket, position, estimated_wait_minutes, business, waiting_count, serving_count } = data;

  const Hero = () => {
    if (ticket.status === "completed") {
      return (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h2 className="font-serif-display text-4xl mt-4">All done.</h2>
          <p className="mt-2 text-stone-600">Thank you for visiting {business?.business_name}.</p>
          {ticket.service_price > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Total amount</p>
              <p className="font-serif-display text-3xl mt-1 text-primary" data-testid="ticket-completed-total">
                ₹{Number(ticket.service_price).toLocaleString("en-IN")}
              </p>
            </div>
          )}
          {ticket.paid && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success border border-success/30 px-3 py-1 text-[11px] uppercase tracking-[0.22em]" data-testid="ticket-paid-badge">
              <CheckCircle2 className="h-3 w-3" /> Paid
              {ticket.payment_method === "cash" ? " · Cash" : ticket.payment_method === "online" ? " · Online" : ""}
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
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Your token</p>
            <p className="font-serif-display text-6xl text-stone-900">#{String(ticket.token_number).padStart(3, "0")}</p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-primary mt-6">It&apos;s your turn</p>
          <h2 className="font-serif-display text-4xl mt-2">Please head to {business?.station_label || "Station"} {ticket.chair_number}</h2>
        </div>
      );
    }
    return (
      <div className="text-center py-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Your token</p>
          <p className="font-serif-display text-4xl text-stone-900">#{String(ticket.token_number).padStart(3, "0")}</p>
        </div>
        {position !== 1 && (
          <p className="text-[11px] uppercase tracking-[0.26em] text-primary">You&apos;re in the queue</p>
        )}
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="warm-hero-gradient grain">
        <div className="mx-auto max-w-md px-5 pt-12 pb-10">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-stone-200/80 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20">
                <LogoMark className="h-6 w-6" />
              </span>
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Queue by</p>
                <p className="text-sm font-semibold leading-none text-foreground">Go-Next</p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.26em] text-primary text-center">Ticket status</p>
          <h1 className="font-serif-display mt-3 text-4xl sm:text-5xl leading-none text-center">{business?.business_name}</h1>
          {business?.address && (
            <p className="mt-2 text-sm text-stone-600 flex items-center justify-center gap-1.5 text-center">
              <MapPin className="h-3.5 w-3.5" /> {business.address}{business.city ? `, ${business.city}` : ""}
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Waiting</p>
              <p className="font-serif-display text-2xl text-primary">{waiting_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Serving</p>
              <p className="font-serif-display text-2xl text-success">{serving_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Chairs</p>
              <p className="font-serif-display text-2xl text-stone-900">{business?.total_chairs ?? 1}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 -mt-2 pb-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          {/* Token number is now shown only in the serving state of the Hero component */}
          <Hero />

          {ticket.status === "waiting" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-secondary px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Approx wait</p>
                <p className="font-serif-display text-2xl mt-1">{estimated_wait_minutes}m</p>
              </div>
              <div className="rounded-2xl bg-secondary px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Your name</p>
                <p className="font-serif-display text-2xl mt-1 truncate">{ticket.customer_name}</p>
              </div>
            </div>
          )}

          {(ticket.service_name || ticket.service_price > 0) && (
            <div className="mt-4 rounded-2xl border border-stone-200 px-4 py-3 flex items-center justify-between" data-testid="ticket-service-row">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  {ticket.service_count > 1 ? "Services" : "Service"}
                </p>
                <p className="font-medium truncate">{ticket.service_name || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Total amount</p>
                <p className="font-serif-display text-2xl text-primary" data-testid="ticket-total">
                  {ticket.service_price > 0
                    ? `₹${Number(ticket.service_price).toLocaleString("en-IN")}`
                    : "Final amount at checkout"}
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
            className="mt-4 w-full h-12 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
            data-testid="ticket-rejoin"
          >
            Join the queue again
          </Button>
        )}
      </div>
    </div>
  );
}

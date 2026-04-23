import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MailCheck, Copy } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null); // { message, preview_reset_link? }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(data);
      if (data.preview_reset_link) {
        toast.success("Preview link ready — copy or click to continue");
      } else {
        toast.success("If this email is registered, you'll receive a link.");
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = (value) => {
    navigator.clipboard.writeText(value);
    toast.success("Link copied");
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="forgot-back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>

        <h1 className="font-serif-display mt-5 text-4xl sm:text-5xl leading-tight">
          Forgot your password?
        </h1>
        <p className="mt-3 text-stone-600">
          Enter your account email and we&apos;ll send you a short-lived link to set a new one. The link works for <strong>30 minutes</strong>.
        </p>

        {!sent ? (
          <form onSubmit={submit} className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 space-y-4" data-testid="forgot-form">
            <div>
              <Label>Email</Label>
              <Input type="email" required className="mt-1.5 h-11" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full h-11 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
              data-testid="forgot-submit">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6" data-testid="forgot-sent">
            <div className="flex items-start gap-3">
              <MailCheck className="h-5 w-5 text-[#4c6547] mt-0.5" />
              <div>
                <p className="font-serif-display text-2xl leading-tight">Check your inbox</p>
                <p className="mt-1 text-sm text-stone-600">{sent.message}</p>
              </div>
            </div>
            {sent.preview_reset_link && (
              <div className="mt-5 rounded-xl border border-dashed border-[#C47C5C]/40 bg-[#F4EFE8]/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#A86246]">Preview mode · no email yet</p>
                <p className="mt-2 text-xs text-stone-600 break-all" data-testid="preview-link">{sent.preview_reset_link}</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => copy(sent.preview_reset_link)} variant="outline" className="flex-1 rounded-full border-stone-300" data-testid="preview-copy">
                    <Copy className="h-4 w-4 mr-1.5" /> Copy link
                  </Button>
                  <Button onClick={() => navigate(new URL(sent.preview_reset_link).pathname + new URL(sent.preview_reset_link).search)}
                    className="flex-1 rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white"
                    data-testid="preview-open">
                    Open reset page
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

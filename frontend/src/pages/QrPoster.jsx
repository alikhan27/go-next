import { useMemo, useRef } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";

/**
 * Printable A4-style customer-facing QR poster for an outlet.
 * Opened from the Dashboard. Use the browser's Print dialog (⌘/Ctrl+P)
 * to print or save as PDF.
 */
export default function QrPoster() {
  const { businessId } = useParams();
  const { auth } = useAuth();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const posterRef = useRef(null);

  const joinUrl = useMemo(
    () => (business ? `${window.location.origin}/join/${business.id}` : ""),
    [business],
  );

  if (auth === null) return null;
  if (!auth || auth === false) return <Navigate to="/login" replace />;
  if (!business) return <Navigate to="/dashboard" replace />;

  const downloadSvg = () => {
    const svg = posterRef.current?.querySelector("svg");
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${business.business_name}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#EDE8DF]" data-testid="qr-poster-page">
      {/* Controls — hidden when printing */}
      <div className="no-print sticky top-0 z-10 border-b border-stone-200 bg-[#F9F8F6]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link
            to={`/dashboard/${business.id}`}
            className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
            data-testid="qr-poster-back"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadSvg}
              className="rounded-full border-stone-300"
              data-testid="qr-poster-download"
            >
              <Download className="h-4 w-4 mr-1.5" /> SVG
            </Button>
            <Button
              onClick={() => window.print()}
              className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
              data-testid="qr-poster-print"
            >
              <Printer className="h-4 w-4 mr-1.5" /> Print poster
            </Button>
          </div>
        </div>
      </div>

      {/* Poster — A4 proportions, centred */}
      <main className="mx-auto max-w-4xl px-5 py-10 print:p-0 print:max-w-none">
        <div
          ref={posterRef}
          className="poster-sheet mx-auto bg-white shadow-[0_40px_80px_-30px_rgba(168,98,70,0.35)] rounded-2xl border border-stone-200 print:border-0 print:rounded-none print:shadow-none"
          data-testid="qr-poster-sheet"
        >
          <div className="h-full w-full flex flex-col items-center justify-between px-14 py-16 text-[#2C302E]">
            <div className="w-full text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#A86246]">
                {business.business_type || "Salon"}
              </p>
              <h1 className="font-serif-display text-5xl sm:text-6xl mt-3 leading-[1.05]">
                {business.business_name}
              </h1>
              {(business.address || business.city) && (
                <p className="mt-3 text-sm text-stone-500">
                  {[business.address, business.city, business.state, business.pincode]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="rounded-3xl bg-[#F4EFE8] p-8 border border-[#E3D9C8]">
                <QRCodeSVG
                  value={joinUrl}
                  size={340}
                  bgColor="#F4EFE8"
                  fgColor="#2C302E"
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="mt-8 font-serif-display text-4xl text-center leading-tight">
                Scan to join the queue
              </p>
              <p className="mt-2 text-sm text-stone-500 text-center max-w-sm">
                Skip the wait — get a live ticket with your position and ETA on your phone.
              </p>
            </div>

            <div className="w-full flex items-end justify-between text-xs text-stone-400">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display text-[11px]">g</div>
                <span>Powered by Go-Next</span>
              </div>
              <span className="truncate max-w-[60%] text-right">{joinUrl}</span>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .poster-sheet {
          /* A4 aspect ratio (1 : 1.414) — prints perfectly on a single sheet */
          aspect-ratio: 1 / 1.414;
          width: 100%;
          max-width: 780px;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .poster-sheet {
            max-width: none !important;
            width: 100vw !important;
            height: 100vh !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] px-5">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">404</p>
        <h1 className="font-serif-display mt-3 text-5xl">Nothing here, yet.</h1>
        <p className="mt-3 text-stone-600">The page you&apos;re looking for has drifted off.</p>
        <Link to="/" className="inline-block mt-8" data-testid="not-found-home">
          <Button className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white h-11 px-6">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}

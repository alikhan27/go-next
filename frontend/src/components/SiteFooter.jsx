import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white mt-auto w-full">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
        <p className="text-xs text-stone-500">
          © {new Date().getFullYear()} Go-Next Queue Platform
        </p>
        <div className="flex gap-4 text-xs text-stone-600">
          <a href="/#pricing" className="hover:text-stone-900">
            Pricing
          </a>
          <Link to="/login" className="hover:text-stone-900">
            Sign in
          </Link>
          <Link to="/register" className="hover:text-stone-900">
            Create account
          </Link>
          <Link to="/join/demo-salon" className="hover:text-stone-900">
            Demo queue
          </Link>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "@tanstack/react-router";

export function Logo({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2 group">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.65_0.16_220)] shadow-sm shadow-primary/20 transition-transform group-hover:scale-[1.03]">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
          <path d="M9 11h4M11 9v4" />
        </svg>
      </div>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          Skin<span className="text-primary">Scan</span>
        </span>
      )}
    </Link>
  );
}

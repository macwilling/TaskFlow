import { Zap } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="flex flex-col items-center gap-3"
        style={{ animation: "loader-fade-in 120ms ease 130ms both" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2.5} />
        </div>

        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold tracking-tight">BillableDesk</p>
          <p className="text-xs text-muted-foreground">Getting your workspace ready</p>
        </div>

        <div className="flex gap-1.5 pt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>

      <style>{`
        @keyframes loader-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

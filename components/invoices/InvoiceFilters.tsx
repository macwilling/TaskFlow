"use client";

const STATUSES = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

interface Client {
  id: string;
  name: string;
}

interface InvoiceFiltersProps {
  status: string;
  clientId: string;
  clients: Client[];
  onStatusChange: (status: string) => void;
  onClientChange: (clientId: string) => void;
}

export function InvoiceFilters({ status, clientId, clients, onStatusChange, onClientChange }: InvoiceFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value)}
            className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
              status === s.value
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {clients.length > 0 && (
        <select
          value={clientId || ""}
          onChange={(e) => onClientChange(e.target.value)}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

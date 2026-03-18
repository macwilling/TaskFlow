"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceListView } from "./InvoiceListView";
import { InvoiceFilters } from "./InvoiceFilters";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  client_id: string;
  clients: { name: string; color: string | null } | null;
}

interface Client {
  id: string;
  name: string;
}

function effectiveStatus(status: string, dueDate: string | null): string {
  if (status === "paid") return "paid";
  if (dueDate && new Date(dueDate) < new Date() && status !== "draft") return "overdue";
  return status;
}

function syncUrl(status: string, clientId: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (clientId) params.set("client", clientId);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/app/finance/invoices?${qs}` : "/app/finance/invoices");
}

export function InvoicesView({ invoices, clients }: { invoices: Invoice[]; clients: Client[] }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [clientId, setClientId] = useState(searchParams.get("client") ?? "");

  function handleStatusChange(s: string) {
    setStatus(s);
    syncUrl(s, clientId);
  }

  function handleClientChange(c: string) {
    setClientId(c);
    syncUrl(status, c);
  }

  const filtered = invoices.filter((inv) => {
    if (clientId && inv.client_id !== clientId) return false;
    if (status) {
      const es = effectiveStatus(inv.status, inv.due_date);
      if (es !== status) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <InvoiceFilters
        status={status}
        clientId={clientId}
        clients={clients}
        onStatusChange={handleStatusChange}
        onClientChange={handleClientChange}
      />
      <InvoiceListView invoices={filtered} />
    </div>
  );
}

"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createInvoiceAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  color: string | null;
  default_rate: number | null;
}

interface TimeEntry {
  id: string;
  description: string;
  entry_date: string;
  duration_hours: number;
  billable: boolean;
  billed: boolean;
  hourly_rate: number | null;
  clients: { name: string } | null;
  tasks: { title: string } | null;
}

interface LineItem {
  key: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  time_entry_id: string | null;
  imported: boolean; // true = came from a time entry
}

interface InvoiceBuilderClientProps {
  clients: Client[];
  defaultTaxRate: number;
  defaultPaymentTerms: number;
  invoiceNumberPrefix: string;
  invoiceNumberNext: number;
  taxLabel: string;
  paymentMethodOptions: string[];
  // Pre-populated for edit mode
  initialData?: {
    clientId: string;
    issueDate: string;
    dueDate: string;
    memo: string;
    discountType: string;
    discountValue: number;
    taxRate: number;
    lineItems: LineItem[];
  };
  formAction?: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
}

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let keyCounter = 0;
function nextKey() {
  return `li-${++keyCounter}-${Date.now()}`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function isoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoiceBuilderClient({
  clients,
  defaultTaxRate,
  defaultPaymentTerms,
  invoiceNumberPrefix,
  invoiceNumberNext,
  taxLabel,
  initialData,
  formAction,
}: InvoiceBuilderClientProps) {
  const today = isoDate(new Date());
  const defaultDue = isoDate(
    new Date(Date.now() + defaultPaymentTerms * 24 * 60 * 60 * 1000)
  );

  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId ?? "");
  const [issueDate, setIssueDate] = useState(initialData?.issueDate ?? today);
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? defaultDue);
  const [memo, setMemo] = useState(initialData?.memo ?? "");
  const [discountType, setDiscountType] = useState<"flat" | "percent" | "">(
    (initialData?.discountType as "flat" | "percent" | "") ?? ""
  );
  const [discountValue, setDiscountValue] = useState(initialData?.discountValue ?? 0);
  const [taxRate, setTaxRate] = useState(initialData?.taxRate ?? defaultTaxRate);
  const [lineItems, setLineItems] = useState<LineItem[]>(initialData?.lineItems ?? []);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const action = formAction ?? createInvoiceAction;
  const [state, dispatch] = useActionState(action, null);

  // Fetch unbilled time entries when client changes
  useEffect(() => {
    if (!selectedClientId) {
      setTimeEntries([]);
      return;
    }
    setLoadingEntries(true);
    fetch(`/api/time-entries?client=${selectedClientId}&billed=false&billable=true`)
      .then((r) => r.json())
      .then((data: TimeEntry[]) => setTimeEntries(Array.isArray(data) ? data : []))
      .catch(() => setTimeEntries([]))
      .finally(() => setLoadingEntries(false));
  }, [selectedClientId]);

  // Totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const discountAmount =
    discountType === "flat"
      ? discountValue
      : discountType === "percent"
      ? subtotal * (discountValue / 100)
      : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;

  // Line item helpers
  const updateLineItem = useCallback((key: string, field: keyof LineItem, value: unknown) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        const updated = { ...li, [field]: value };
        if (field === "quantity" || field === "unit_price") {
          updated.amount = Number(updated.quantity) * Number(updated.unit_price);
        }
        return updated;
      })
    );
  }, []);

  const removeLineItem = useCallback((key: string) => {
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  }, []);

  const addManualItem = useCallback(() => {
    const client = clients.find((c) => c.id === selectedClientId);
    setLineItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        description: "",
        quantity: 1,
        unit_price: client?.default_rate ?? 0,
        amount: client?.default_rate ?? 0,
        sort_order: prev.length,
        time_entry_id: null,
        imported: false,
      },
    ]);
  }, [clients, selectedClientId]);

  const isEntryImported = useCallback(
    (entryId: string) => lineItems.some((li) => li.time_entry_id === entryId),
    [lineItems]
  );

  const toggleTimeEntry = useCallback(
    (entry: TimeEntry) => {
      if (isEntryImported(entry.id)) {
        setLineItems((prev) => prev.filter((li) => li.time_entry_id !== entry.id));
      } else {
        const rate = entry.hourly_rate ?? clients.find((c) => c.id === selectedClientId)?.default_rate ?? 0;
        const qty = Number(entry.duration_hours);
        setLineItems((prev) => [
          ...prev,
          {
            key: nextKey(),
            description: entry.description,
            quantity: qty,
            unit_price: rate,
            amount: qty * rate,
            sort_order: prev.length,
            time_entry_id: entry.id,
            imported: true,
          },
        ]);
      }
    },
    [clients, isEntryImported, selectedClientId]
  );

  const lineItemsJson = JSON.stringify(
    lineItems.map((li, i) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      amount: li.amount,
      sort_order: i,
      time_entry_id: li.time_entry_id,
    }))
  );

  return (
    <form action={dispatch} className="space-y-8 max-w-4xl">
      {/* ── Header row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="client_id" className="text-xs">Client</Label>
          <Select
            name="client_id"
            value={selectedClientId}
            onValueChange={setSelectedClientId}
          >
            <SelectTrigger id="client_id" className="h-8 text-xs">
              <SelectValue placeholder="Select client…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? "#0969da" }}
                    />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Invoice #</Label>
          <div className="h-8 flex items-center rounded-md border border-border bg-muted/50 px-3 text-xs text-muted-foreground font-mono">
            {invoiceNumberPrefix}{invoiceNumberNext}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issue_date" className="text-xs">Issue Date</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="due_date" className="text-xs">Due Date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <Separator />

      {/* ── Time entries import ── */}
      {selectedClientId && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Unbilled Time Entries
          </p>
          {loadingEntries ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : timeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unbilled billable entries for this client.</p>
          ) : (
            <div className="rounded-md border border-border divide-y divide-border">
              {timeEntries.map((entry) => {
                const checked = isEntryImported(entry.id);
                return (
                  <label
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleTimeEntry(entry)}
                    />
                    <span className="flex-1 min-w-0 text-xs text-foreground truncate">
                      {entry.description}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(entry.entry_date)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-12 text-right">
                      {Number(entry.duration_hours).toFixed(2)}h
                    </span>
                    {entry.hourly_rate != null && (
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-16 text-right">
                        {formatCurrency(Number(entry.hourly_rate))}/hr
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Line items table ── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Line Items
        </p>
        {lineItems.length > 0 && (
          <div className="rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((li) => (
                  <tr key={li.key} className="group">
                    <td className="px-3 py-2">
                      <Input
                        value={li.description}
                        onChange={(e) => updateLineItem(li.key, "description", e.target.value)}
                        placeholder="Description"
                        className="h-7 text-xs border-transparent hover:border-border focus:border-border"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(li.key, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-right border-transparent hover:border-border focus:border-border"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.unit_price}
                        onChange={(e) => updateLineItem(li.key, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-right border-transparent hover:border-border focus:border-border"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(li.amount)}
                    </td>
                    <td className="pr-2">
                      <button
                        type="button"
                        onClick={() => removeLineItem(li.key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addManualItem}>
          <Plus className="h-3.5 w-3.5" />
          Add item
        </Button>
      </div>

      <Separator />

      {/* ── Totals panel ── */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex-1">Discount</span>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as "flat" | "percent" | "")}
            >
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">None</SelectItem>
                <SelectItem value="flat" className="text-xs">$</SelectItem>
                <SelectItem value="percent" className="text-xs">%</SelectItem>
              </SelectContent>
            </Select>
            {discountType && (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="h-6 w-20 text-xs text-right"
              />
            )}
            {discountType && (
              <span className="text-xs tabular-nums w-20 text-right">
                -{formatCurrency(discountAmount)}
              </span>
            )}
          </div>

          {/* Tax */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex-1">Tax rate (%)</span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={(taxRate * 100).toFixed(2)}
              onChange={(e) => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
              className="h-6 w-20 text-xs text-right"
            />
            <span className="text-xs tabular-nums w-20 text-right">{formatCurrency(taxAmount)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Memo ── */}
      <div className="space-y-1.5">
        <Label htmlFor="memo" className="text-xs">Memo / Notes</Label>
        <Textarea
          id="memo"
          name="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Payment instructions, thank you note, etc."
          className="text-xs min-h-[80px] resize-none"
        />
      </div>

      {/* Hidden fields */}
      <input type="hidden" name="line_items" value={lineItemsJson} />
      <input type="hidden" name="discount_type" value={discountType} />
      <input type="hidden" name="discount_value" value={discountValue} />
      <input type="hidden" name="tax_rate" value={taxRate} />

      {/* Error */}
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <SubmitButton label="Save as draft" />
      </div>
    </form>
  );
}

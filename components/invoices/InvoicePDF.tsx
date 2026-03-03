import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Font registration ────────────────────────────────────────────────────────

const geistRegular = path.join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf"
);
const geistBold = path.join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf"
);
const geistMedium = path.join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf"
);

Font.register({
  family: "Geist",
  fonts: [
    { src: geistRegular, fontWeight: 400 },
    { src: geistMedium, fontWeight: 500 },
    { src: geistBold, fontWeight: 700 },
  ],
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoicePDFProps {
  invoice: {
    invoice_number: string;
    status: string;
    issue_date: string;
    due_date: string | null;
    memo: string | null;
    subtotal: number;
    discount_type: string | null;
    discount_value: number | null;
    tax_rate: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    clients: {
      name: string;
      email: string | null;
      billing_address: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      } | null;
    } | null;
    invoice_line_items: {
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
      sort_order: number;
    }[];
  };
  settings: {
    business_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    email: string | null;
    phone: string | null;
    tax_label: string | null;
    payment_method_options: string[] | null;
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = "#0969da";
const GRAY = "#6e7781";
const LIGHT = "#f6f8fa";
const BORDER = "#d0d7de";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9,
    color: "#1f2328",
    padding: 48,
    lineHeight: 1.5,
  },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  businessName: { fontSize: 14, fontWeight: 700, color: ACCENT },
  businessInfo: { fontSize: 8, color: GRAY, marginTop: 4 },
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: "#1f2328", textAlign: "right" },
  invoiceMeta: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 4 },
  invoiceNumber: { fontSize: 10, fontWeight: 700, color: ACCENT, textAlign: "right", marginTop: 2 },
  // Bill-to
  billToSection: { flexDirection: "row", marginBottom: 28 },
  billToBlock: { flex: 1 },
  billToLabel: { fontSize: 7, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  billToName: { fontSize: 10, fontWeight: 700 },
  billToAddress: { fontSize: 8, color: GRAY, marginTop: 2 },
  // Dates
  datesBlock: { flex: 1, alignItems: "flex-end" },
  dateRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  dateLabel: { fontSize: 7, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5, width: 60, textAlign: "right" },
  dateValue: { fontSize: 8 },
  // Line items table
  table: { marginBottom: 20 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colRate: { width: 70, textAlign: "right" },
  colAmount: { width: 80, textAlign: "right" },
  thText: { fontSize: 7, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5 },
  tdText: { fontSize: 9 },
  // Totals
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 24 },
  totalsTable: { width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8 },
  totalRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderColor: BORDER,
    backgroundColor: LIGHT,
  },
  totalLabel: { fontSize: 8, color: GRAY },
  totalValue: { fontSize: 8, tabularNums: true },
  totalLabelBold: { fontSize: 10, fontWeight: 700 },
  totalValueBold: { fontSize: 10, fontWeight: 700, color: ACCENT },
  // Memo
  memoSection: { marginBottom: 24 },
  memoLabel: { fontSize: 7, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  memoText: { fontSize: 8, color: GRAY },
  // Footer
  footer: { borderTopWidth: 1, borderColor: BORDER, paddingTop: 12, marginTop: "auto" },
  footerText: { fontSize: 7, color: GRAY, textAlign: "center" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return "—";
  const [year, month, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function currency(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicePDF({ invoice, settings }: InvoicePDFProps) {
  const client = invoice.clients;
  const addr = client?.billing_address;
  const billingLines: string[] = [];
  if (addr?.line1) billingLines.push(addr.line1);
  if (addr?.line2) billingLines.push(addr.line2);
  if (addr?.city || addr?.state || addr?.postal_code) {
    const parts = [addr.city, addr.state, addr.postal_code].filter(Boolean);
    billingLines.push(parts.join(", "));
  }
  if (addr?.country && addr.country !== "US") billingLines.push(addr.country);

  const businessLines: string[] = [];
  if (settings.address_line1) businessLines.push(settings.address_line1);
  if (settings.address_line2) businessLines.push(settings.address_line2);
  const cityLine = [settings.city, settings.state, settings.postal_code].filter(Boolean).join(", ");
  if (cityLine) businessLines.push(cityLine);
  if (settings.email) businessLines.push(settings.email);
  if (settings.phone) businessLines.push(settings.phone);

  const sortedItems = [...invoice.invoice_line_items].sort((a, b) => a.sort_order - b.sort_order);
  const subtotal = Number(invoice.subtotal);
  const discountValue = Number(invoice.discount_value ?? 0);
  const discountAmount = invoice.discount_type === "flat"
    ? discountValue
    : invoice.discount_type === "percent"
    ? subtotal * (discountValue / 100)
    : 0;
  const taxAmount = Number(invoice.tax_amount);
  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amount_paid);
  const balanceDue = total - amountPaid;
  const taxLabel = settings.tax_label ?? "Tax";
  const taxRate = Number(invoice.tax_rate);

  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{settings.business_name ?? "Your Business"}</Text>
            {businessLines.map((line, i) => (
              <Text key={i} style={styles.businessInfo}>{line}</Text>
            ))}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Bill-to + Dates */}
        <View style={styles.billToSection}>
          <View style={styles.billToBlock}>
            <Text style={styles.billToLabel}>Bill To</Text>
            <Text style={styles.billToName}>{client?.name ?? "—"}</Text>
            {client?.email && (
              <Text style={styles.billToAddress}>{client.email}</Text>
            )}
            {billingLines.map((line, i) => (
              <Text key={i} style={styles.billToAddress}>{line}</Text>
            ))}
          </View>
          <View style={styles.datesBlock}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Issue Date</Text>
              <Text style={styles.dateValue}>{fmt(invoice.issue_date)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Due Date</Text>
              <Text style={styles.dateValue}>{fmt(invoice.due_date)}</Text>
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colDesc]}>Description</Text>
            <Text style={[styles.thText, styles.colQty]}>Qty</Text>
            <Text style={[styles.thText, styles.colRate]}>Rate</Text>
            <Text style={[styles.thText, styles.colAmount]}>Amount</Text>
          </View>
          {sortedItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tdText, styles.colQty]}>{Number(item.quantity).toFixed(2)}</Text>
              <Text style={[styles.tdText, styles.colRate]}>{currency(Number(item.unit_price))}</Text>
              <Text style={[styles.tdText, styles.colAmount]}>{currency(Number(item.amount))}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{currency(subtotal)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Discount{invoice.discount_type === "percent" ? ` (${discountValue}%)` : ""}
                </Text>
                <Text style={styles.totalValue}>-{currency(discountAmount)}</Text>
              </View>
            )}
            {taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {taxLabel}{taxRate > 0 ? ` (${(taxRate * 100).toFixed(2)}%)` : ""}
                </Text>
                <Text style={styles.totalValue}>{currency(taxAmount)}</Text>
              </View>
            )}
            <View style={styles.totalRowBold}>
              <Text style={styles.totalLabelBold}>Total</Text>
              <Text style={styles.totalValueBold}>{currency(total)}</Text>
            </View>
            {amountPaid > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Amount Paid</Text>
                  <Text style={styles.totalValue}>-{currency(amountPaid)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { fontWeight: 700 }]}>Balance Due</Text>
                  <Text style={[styles.totalValue, { fontWeight: 700 }]}>{currency(balanceDue)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Memo */}
        {invoice.memo && (
          <View style={styles.memoSection}>
            <Text style={styles.memoLabel}>Notes</Text>
            <Text style={styles.memoText}>{invoice.memo}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {settings.business_name ?? "Your Business"} · {invoice.invoice_number} · Thank you for your business.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

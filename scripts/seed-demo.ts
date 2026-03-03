#!/usr/bin/env node
/**
 * seed-demo.ts — MinistryPlatform consulting demo account
 *
 * Creates a realistic dataset for a consultant who configures MinistryPlatform
 * for large churches: page views, record insights, custom reports, widgets,
 * automation workflows, API integrations, and staff training.
 *
 * Login: sampleuser@example.com / sampleuser
 *
 * Run: npx tsx scripts/seed-demo.ts
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Config ───────────────────────────────────────────────────────────────────

const DEMO_EMAIL = "sampleuser@example.com";
const DEMO_PASSWORD = "sampleuser";
const DEMO_BUSINESS = "Apex Ministry Solutions";
const DEMO_SLUG = "apex-ministry-solutions";

// ── Date helpers ─────────────────────────────────────────────────────────────

const today = new Date();
today.setHours(0, 0, 0, 0);

function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysFromNow(n: number): string {
  return daysAgo(-n);
}

function tsAgo(n: number): string {
  return new Date(today.getTime() - n * 86400000).toISOString();
}

// ── Error helper ─────────────────────────────────────────────────────────────

function assertOk<T>(result: { data: T; error: unknown }, label: string): NonNullable<T> {
  if (result.error) {
    console.error(`  ❌ ${label}:`, result.error);
    process.exit(1);
  }
  if (result.data == null) {
    console.error(`  ❌ ${label}: returned null data`);
    process.exit(1);
  }
  return result.data as NonNullable<T>;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function deleteTenant(tid: string) {
  await admin.from("payments").delete().eq("tenant_id", tid);
  await admin.from("invoice_line_items").delete().eq("tenant_id", tid);
  await admin.from("time_entries").delete().eq("tenant_id", tid);
  await admin.from("invoices").delete().eq("tenant_id", tid);
  await admin.from("comments").delete().eq("tenant_id", tid);
  await admin.from("task_attachments").delete().eq("tenant_id", tid);
  await admin.from("tasks").delete().eq("tenant_id", tid);
  await admin.from("clients").delete().eq("tenant_id", tid);
  await admin.from("email_log").delete().eq("tenant_id", tid);
  await admin.from("tenant_settings").delete().eq("tenant_id", tid);
  await admin.from("profiles").delete().eq("tenant_id", tid);
  await admin.from("tenants").delete().eq("id", tid);
  console.log(`  Tenant ${tid} and all data deleted.`);
}

async function cleanup() {
  console.log("  Checking for existing demo account...");

  // Clean up orphaned tenant by slug (handles mid-run crash recovery)
  const { data: orphanTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (orphanTenant?.id) {
    console.log(`  Found orphaned tenant by slug — cleaning up...`);
    await deleteTenant(orphanTenant.id);
  }

  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const existing = users.users.find((u) => u.email === DEMO_EMAIL);
  if (!existing) {
    console.log("  No existing demo auth user found.");
    return;
  }

  console.log(`  Found existing user ${existing.id} — cleaning up...`);

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", existing.id)
    .maybeSingle();

  if (profile?.tenant_id) {
    await deleteTenant(profile.tenant_id);
  }

  await admin.auth.admin.deleteUser(existing.id);
  console.log("  Auth user deleted.");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱 TaskFlow Demo Seed — MinistryPlatform Consulting\n");

  // ── Step 1: cleanup + auth user ──────────────────────────────────────────
  console.log("1/7  Auth user");
  await cleanup();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (userError) throw userError;
  const userId = userData.user.id;
  console.log(`     Created user ${userId}`);

  // ── Step 2: tenant + profile + settings ──────────────────────────────────
  console.log("\n2/7  Tenant & settings");

  const tenant = assertOk(
    await admin.from("tenants").insert({ slug: DEMO_SLUG }).select("id").single(),
    "create tenant"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId: string = (tenant as any).id;

  await admin.from("profiles").insert({
    id: userId,
    tenant_id: tenantId,
    role: "admin",
    full_name: "Alex MacKenzie",
  });

  await admin.from("tenant_settings").insert({
    tenant_id: tenantId,
    business_name: DEMO_BUSINESS,
    email: "alex@apexministry.io",
    phone: "(512) 555-0142",
    address_line1: "4801 S Lamar Blvd, Suite 200",
    city: "Austin",
    state: "TX",
    postal_code: "78745",
    invoice_number_prefix: "INV-",
    invoice_number_next: 1009, // 8 invoices seeded (1001–1008)
    default_payment_terms: 30,
    default_tax_rate: 0,
    portal_welcome_message:
      "Welcome! Use this portal to track your MinistryPlatform project status, review completed work, and communicate with your consultant.",
  });

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin", tenant_id: tenantId },
  });

  console.log(`     Tenant ${tenantId} configured.`);

  // ── Step 3: clients ───────────────────────────────────────────────────────
  console.log("\n3/7  Clients (5 churches)");

  const clientRows = [
    {
      name: "Pastor Sarah Mitchell",
      company: "Covenant Community Church",
      email: "smitchell@covenanthouston.org",
      phone: "(713) 555-0183",
      default_rate: 175,
      payment_terms: 30,
      currency: "USD",
      color: "#2da44e",
      client_key: "CCC",
      next_task_number: 5,
      billing_address: {
        line1: "8800 Westheimer Rd",
        city: "Houston",
        state: "TX",
        postal_code: "77063",
        country: "US",
      },
      notes:
        "Largest client — 12,000 weekly attendance. Uses MP for groups, giving, volunteers, and events. Prefers async updates via task comments. Pays by ACH within 30 days.",
    },
    {
      name: "Marcus Webb",
      company: "Grace Fellowship Church",
      email: "mwebb@gracefellowship.org",
      phone: "(404) 555-0271",
      default_rate: 165,
      payment_terms: 30,
      currency: "USD",
      color: "#8250df",
      client_key: "GFC",
      next_task_number: 5,
      billing_address: {
        line1: "3300 Peachtree Rd NE",
        city: "Atlanta",
        state: "GA",
        postal_code: "30326",
        country: "US",
      },
      notes:
        "IT Director manages all MP work. Five campuses. Heavy use of Record Insights for donor engagement. Actively expanding online giving workflows.",
    },
    {
      name: "Jennifer Park",
      company: "Hillside Church",
      email: "jpark@hillsidechurch.org",
      phone: "(303) 555-0394",
      default_rate: 175,
      payment_terms: 30,
      currency: "USD",
      color: "#0969da",
      client_key: "HSC",
      next_task_number: 5,
      billing_address: {
        line1: "6500 E Hampden Ave",
        city: "Denver",
        state: "CO",
        postal_code: "80237",
        country: "US",
      },
      notes:
        "Operations Director. Fast-growing church, 8,000+ attendance. Focus on automation and group life. Very tech-savvy team — minimal hand-holding needed.",
    },
    {
      name: "David Thompson",
      company: "First Baptist Metropolis",
      email: "dthompson@fbmetropolis.org",
      phone: "(214) 555-0517",
      default_rate: 150,
      payment_terms: 30,
      currency: "USD",
      color: "#e36209",
      client_key: "FBM",
      next_task_number: 4,
      billing_address: {
        line1: "1234 Commerce St",
        city: "Dallas",
        state: "TX",
        postal_code: "75201",
        country: "US",
      },
      notes:
        "Executive Pastor oversees all MP decisions. Older staff, need more training and documentation. Two open invoices — follow up with David on payment for INV-1004 (overdue).",
    },
    {
      name: "Lisa Chen",
      company: "Northgate Church",
      email: "lchen@northgatechurch.org",
      phone: "(206) 555-0628",
      default_rate: 185,
      payment_terms: 30,
      currency: "USD",
      color: "#cf222e",
      client_key: "NGC",
      next_task_number: 4,
      billing_address: {
        line1: "18300 Aurora Ave N",
        city: "Seattle",
        state: "WA",
        postal_code: "98133",
        country: "US",
      },
      notes:
        "Admin Director, very detail-oriented. Highest rate — complex custom dev and API work. Has a dedicated integration budget. Interested in expanding MP API surface.",
    },
  ];

  const clients = assertOk(
    await admin
      .from("clients")
      .insert(clientRows.map((c) => ({ ...c, tenant_id: tenantId })))
      .select("id, client_key"),
    "insert clients"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any as Array<{ id: string; client_key: string }>;

  const cid = (key: string) => clients.find((c) => c.client_key === key)!.id;
  const ccc = cid("CCC");
  const gfc = cid("GFC");
  const hsc = cid("HSC");
  const fbm = cid("FBM");
  const ngc = cid("NGC");

  console.log(`     5 clients created.`);

  // ── Step 4: tasks ─────────────────────────────────────────────────────────
  console.log("\n4/7  Tasks (18 tasks)");

  const taskRows = [
    // ─── Covenant Community Church (CCC) ────────────────────────────────────
    {
      client_id: ccc,
      task_number: 1,
      title: "Build Custom Page View: Volunteer Management",
      description:
        "Build a custom page view in MinistryPlatform that consolidates all volunteers by ministry area. The view should display volunteer name, ministry assignment, last service date, background check status, and training completion. Needs to support filtering by ministry and exporting to CSV for the volunteer coordinator.",
      status: "closed",
      priority: "high",
      estimated_hours: 7,
      tags: ["page-view", "volunteer", "mp-config"],
      due_date: daysAgo(39),
      closed_at: tsAgo(40),
      created_at: tsAgo(45),
      updated_at: tsAgo(40),
    },
    {
      client_id: ccc,
      task_number: 2,
      title: "Recurring Giving Module Configuration",
      description:
        "Configure the Recurring Giving module for Covenant's online giving platform. Set up payment schedules (weekly, bi-weekly, monthly), map to correct program and fund codes, and verify webhook integration with their payment processor (Stripe). Test with sandbox transactions before going live.",
      status: "closed",
      priority: "medium",
      estimated_hours: 4,
      tags: ["configuration", "giving", "mp-config"],
      due_date: daysAgo(35),
      closed_at: tsAgo(36),
      created_at: tsAgo(41),
      updated_at: tsAgo(36),
    },
    {
      client_id: ccc,
      task_number: 3,
      title: "Households Page Lookup Fix",
      description:
        "The Households page search lookup is returning an error when users search by phone number. Investigate the SQL view definition and correct the lookup join condition. This appears to be a field mapping issue introduced after the last MinistryPlatform update (v5.4).",
      resolution_notes:
        "Root cause: breaking change in MP v5.4 renamed the PhoneNumber lookup field in HouseholdView. Fixed the SQL view JOIN condition. Tested all search modes — name, email, phone, address all confirmed working by church IT.",
      status: "closed",
      priority: "urgent",
      estimated_hours: 2,
      tags: ["bug-fix", "mp-config"],
      due_date: daysAgo(24),
      closed_at: tsAgo(25),
      created_at: tsAgo(28),
      updated_at: tsAgo(25),
    },
    {
      client_id: ccc,
      task_number: 4,
      title: "Annual Ministry Report Builder",
      description:
        "Create a comprehensive annual ministry report in MP that pulls data across all ministries: attendance trends, giving totals, volunteer hours, group enrollment, and first-time guest retention rate. Report should be parameterized by fiscal year and exportable to PDF for board presentations.",
      status: "in_progress",
      priority: "medium",
      estimated_hours: 12,
      tags: ["report", "custom-dev", "mp-config"],
      due_date: daysFromNow(14),
      created_at: tsAgo(7),
      updated_at: tsAgo(3),
    },
    // ─── Grace Fellowship Church (GFC) ──────────────────────────────────────
    {
      client_id: gfc,
      task_number: 1,
      title: "Weekly Attendance Report by Campus",
      description:
        "Build a scheduled weekly attendance report that breaks down Sunday service head counts across all 5 Grace Fellowship campuses. Should include year-over-year comparison, first-time visitor counts, and percentage change. Delivered via MP's report distribution to campus pastors every Monday at 7am.",
      resolution_notes:
        "Report live and delivering correctly every Monday. Includes YoY comparison (prior year same date range), first-time guest column, and % change. All 5 campus pastors confirmed receiving the email.",
      status: "closed",
      priority: "medium",
      estimated_hours: 5,
      tags: ["report", "attendance", "mp-config"],
      due_date: daysAgo(39),
      closed_at: tsAgo(41),
      created_at: tsAgo(46),
      updated_at: tsAgo(41),
    },
    {
      client_id: gfc,
      task_number: 2,
      title: "Record Insights: Donor Analysis Dashboard",
      description:
        "Configure a Record Insights dashboard for the development team focused on major donor engagement. Metrics: LYBUNT/SYBUNT donors, giving trends by fund, lapsed donors (12+ months no gift), and average gift size by segment. Needs to be shareable with the Exec Pastor without exposing full financial data.",
      resolution_notes:
        "Dashboard configured with LYBUNT/SYBUNT segments (MP standard 12-month calculation), fund breakdown by giving category, lapsed donor list (12mo+ no gift), and average gift size. Exec Pastor shareable view uses projection to exclude individual donor names — shows aggregated totals only.",
      status: "closed",
      priority: "high",
      estimated_hours: 8,
      tags: ["record-insights", "donors", "finance"],
      due_date: daysAgo(31),
      closed_at: tsAgo(34),
      created_at: tsAgo(40),
      updated_at: tsAgo(34),
    },
    {
      client_id: gfc,
      task_number: 3,
      title: "Online Giving Reconciliation Report",
      description:
        "Build a reconciliation report that matches online giving transactions (from Pushpay) against MP contribution records. Flags unmatched transactions, duplicate records, or fund allocation mismatches. Runs nightly and emails exceptions to the finance team. Needs to handle weekend batch timing differences.",
      status: "in_progress",
      priority: "medium",
      estimated_hours: 6,
      tags: ["report", "finance", "giving"],
      due_date: daysFromNow(10),
      created_at: tsAgo(10),
      updated_at: tsAgo(5),
    },
    {
      client_id: gfc,
      task_number: 4,
      title: "Custom SMS Follow-Up Workflow",
      description:
        "Design and implement a custom automated workflow in MP that sends a personalized SMS to first-time guests 48 hours after their visit. Trigger: new contact with 'First Time Guest' status change. Message template should include campus pastor name and a response link for the guest to indicate interest.",
      status: "in_progress",
      priority: "high",
      estimated_hours: 5,
      tags: ["automation", "sms", "workflow"],
      due_date: daysFromNow(7),
      created_at: tsAgo(4),
      updated_at: tsAgo(2),
    },
    // ─── Hillside Church (HSC) ───────────────────────────────────────────────
    {
      client_id: hsc,
      task_number: 1,
      title: "New Member Follow-Up Automation Workflow",
      description:
        "Build a multi-step automation workflow for new member follow-up: (1) Welcome email with membership class dates 1 day after status change, (2) Group Life introductory text at day 7, (3) Volunteer interest form link at day 21, (4) Personal call reminder to connect team at day 45. All steps configurable via MP's workflow builder.",
      resolution_notes:
        "All 4 workflow steps live and tested with real new member records from last Sunday. Delays firing correctly. Jennifer confirmed she can edit message templates directly in the MP workflow UI. Steps 3 and 4 use dynamic field insertion for the contact's first name.",
      status: "closed",
      priority: "high",
      estimated_hours: 9,
      tags: ["automation", "workflow", "new-members"],
      due_date: daysAgo(40),
      closed_at: tsAgo(42),
      created_at: tsAgo(47),
      updated_at: tsAgo(42),
    },
    {
      client_id: hsc,
      task_number: 2,
      title: "Group Life Module Staff Training",
      description:
        "Deliver a 3-hour virtual training session for Hillside's 6-person group life team covering: creating and managing group types, enrollment workflows, attendance tracking, automated group health reporting, and the Group Finder public page configuration. Record session for future onboarding.",
      resolution_notes:
        "3-hour training delivered via Zoom, recorded and uploaded to Hillside's SharePoint. All 6 staff attended. Covered group types, enrollment, attendance tracking, group health reports, and Group Finder. Follow-up Q&A doc sent the next day.",
      status: "closed",
      priority: "low",
      estimated_hours: 3,
      tags: ["training", "group-life"],
      due_date: daysAgo(33),
      closed_at: tsAgo(34),
      created_at: tsAgo(38),
      updated_at: tsAgo(34),
    },
    {
      client_id: hsc,
      task_number: 3,
      title: "Missions Trip Management Page View",
      description:
        "Design and build a custom page view for the missions team to manage short-term trips. Needs: participant registration, deposit tracking, passport and medical form status, team leader assignments, and a trip roster export. Initial scoping call completed — awaiting final field list approval from missions director before build begins.",
      status: "backlog",
      priority: "medium",
      estimated_hours: 10,
      tags: ["page-view", "missions", "custom-dev"],
      due_date: daysFromNow(21),
      created_at: tsAgo(9),
      updated_at: tsAgo(8),
    },
    {
      client_id: hsc,
      task_number: 4,
      title: "Small Groups Roster Export",
      description:
        "Create a custom export that generates a printable small group roster for each active group: member name, phone, email, attendance percentage, and optional prayer requests. Group leaders need this as a PDF they can print for their weekly meetings. Submitted to Jennifer for review.",
      status: "in_review",
      priority: "medium",
      estimated_hours: 4,
      tags: ["report", "groups", "export"],
      due_date: daysFromNow(3),
      created_at: tsAgo(7),
      updated_at: tsAgo(5),
    },
    // ─── First Baptist Metropolis (FBM) ─────────────────────────────────────
    {
      client_id: fbm,
      task_number: 1,
      title: "Contribution Statements Configuration",
      description:
        "Configure and test the year-end contribution statement process in MP. Customize the template with FBM branding (logo, address, tax ID). Set up the batch process to generate statements for all donors, with options to email or print by preference. Test with sample donor set before running for full 4,200 giving households.",
      resolution_notes:
        "Full 4,200 household batch completed. Fixed 3 PDF errors caused by contacts with NULL email and print=false preference — added null check. David walked through the admin process and can run future batches independently. Statement delivery confirmed by finance team.",
      status: "closed",
      priority: "medium",
      estimated_hours: 6,
      tags: ["configuration", "contributions", "giving"],
      due_date: daysAgo(16),
      closed_at: tsAgo(18),
      created_at: tsAgo(25),
      updated_at: tsAgo(18),
    },
    {
      client_id: fbm,
      task_number: 2,
      title: "Custom Widget: Online Giving Dashboard",
      description:
        "Build a custom JavaScript widget for FBM's church management dashboard showing real-time giving metrics: today's online gifts, MTD vs. budget, top funds, and a 30-day trend sparkline. Widget pulls from MP API and auto-refreshes every 5 minutes. To be embedded via iframe on the staff intranet homepage.",
      resolution_notes:
        "Widget live on FBM intranet. Displays today's giving total, MTD vs budget bar chart, fund breakdown, and 30-day sparkline (Chart.js). Auto-refreshes every 5 minutes. Cross-browser tested (Chrome, Firefox, Edge, Safari). IT has the embed code and API key rotation instructions.",
      status: "closed",
      priority: "high",
      estimated_hours: 10,
      tags: ["custom-widget", "giving", "custom-dev", "api"],
      due_date: daysAgo(9),
      closed_at: tsAgo(11),
      created_at: tsAgo(16),
      updated_at: tsAgo(11),
    },
    {
      client_id: fbm,
      task_number: 3,
      title: "Event Registration Capacity Tracking",
      description:
        "Configure MP's event module to properly enforce capacity limits and waitlists across all FBM event types. Currently online registrations can exceed room capacity. Set up capacity fields, waitlist automation, and a capacity dashboard view for the events coordinator.",
      status: "backlog",
      priority: "medium",
      estimated_hours: 5,
      tags: ["configuration", "events"],
      due_date: daysFromNow(21),
      created_at: tsAgo(6),
      updated_at: tsAgo(6),
    },
    // ─── Northgate Church (NGC) ──────────────────────────────────────────────
    {
      client_id: ngc,
      task_number: 1,
      title: "ProPresenter API Integration",
      description:
        "Build a custom integration between MinistryPlatform and ProPresenter 7 that auto-imports the weekly service order into ProPresenter presentations. The integration pulls from MP's service planning module, maps to ProPresenter's JSON import format, and triggers via webhook on service finalization. Includes error handling and an admin UI for manual re-sync.",
      resolution_notes:
        "Integration live in production. Tech director ran a full Sunday service through the pipeline — all 23 service items imported correctly, including scripture references. Manual re-sync UI accessible at /admin/propresenter. Webhook fires within 30 seconds of MP service finalization.",
      status: "closed",
      priority: "high",
      estimated_hours: 12,
      tags: ["api-integration", "custom-dev", "propresenter"],
      due_date: daysAgo(20),
      closed_at: tsAgo(22),
      created_at: tsAgo(28),
      updated_at: tsAgo(22),
    },
    {
      client_id: ngc,
      task_number: 2,
      title: "User Permissions Audit & Restructure",
      description:
        "Conduct a full audit of Northgate's MP user permission roles and security groups. Document current state, identify over-permissioned accounts (especially financial access), propose a least-privilege role structure. Implement approved changes and document the new role matrix for future onboarding.",
      resolution_notes:
        "Audit complete. Found 12 over-privileged accounts including 4 with finance view access who shouldn't have it. Implemented new 6-role structure (Admin, Finance, Ministry Leader, Group Leader, Check-In Staff, Read Only). 28 user accounts updated. Role matrix doc delivered to Lisa.",
      status: "closed",
      priority: "medium",
      estimated_hours: 4,
      tags: ["permissions", "security", "mp-config"],
      due_date: daysAgo(9),
      closed_at: tsAgo(11),
      created_at: tsAgo(15),
      updated_at: tsAgo(11),
    },
    {
      client_id: ngc,
      task_number: 3,
      title: "Custom Kiosk Check-In Widget",
      description:
        "Develop a touchscreen-optimized check-in kiosk widget for Northgate's lobby iPads that interfaces with MP's Family Check-In module. Features: household lookup by phone, child selection, badge printing via Dymo SDK, and an express check-in mode for returning families. Needs to work offline for 5-minute outages and sync on reconnect.",
      status: "in_progress",
      priority: "high",
      estimated_hours: 20,
      tags: ["custom-widget", "check-in", "custom-dev", "kiosk"],
      due_date: daysFromNow(14),
      created_at: tsAgo(8),
      updated_at: tsAgo(3),
    },
  ];

  const tasks = assertOk(
    await admin
      .from("tasks")
      .insert(taskRows.map((t) => ({ ...t, tenant_id: tenantId })))
      .select("id, client_id, task_number"),
    "insert tasks"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any as Array<{ id: string; client_id: string; task_number: number }>;

  const tid = (clientId: string, num: number) =>
    tasks.find((t) => t.client_id === clientId && t.task_number === num)!.id;

  const ccc1 = tid(ccc, 1); const ccc2 = tid(ccc, 2); const ccc3 = tid(ccc, 3); const ccc4 = tid(ccc, 4);
  const gfc1 = tid(gfc, 1); const gfc2 = tid(gfc, 2); const gfc3 = tid(gfc, 3); const gfc4 = tid(gfc, 4);
  const hsc1 = tid(hsc, 1); const hsc2 = tid(hsc, 2); const hsc3 = tid(hsc, 3); const hsc4 = tid(hsc, 4);
  const fbm1 = tid(fbm, 1); const fbm2 = tid(fbm, 2);
  const ngc1 = tid(ngc, 1); const ngc2 = tid(ngc, 2); const ngc3 = tid(ngc, 3);

  console.log(`     ${tasks.length} tasks created.`);

  // ── Step 5: invoices ──────────────────────────────────────────────────────
  console.log("\n5/7  Invoices (8 invoices)");

  const invoiceRows = [
    {
      // INV-1001: CCC batch 1 — Volunteer page view + Recurring giving → PAID
      client_id: ccc,
      invoice_number: "INV-1001",
      status: "paid",
      issue_date: daysAgo(35),
      due_date: daysAgo(5),
      memo: "January consulting — Custom Volunteer Management page view and Recurring Giving module configuration.",
      subtotal: 1750.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 1750.00,
      amount_paid: 1750.00,
      sent_at: tsAgo(35),
      viewed_at: tsAgo(33),
    },
    {
      // INV-1002: GFC batch 1 — Attendance report + Donor insights → PAID
      client_id: gfc,
      invoice_number: "INV-1002",
      status: "paid",
      issue_date: daysAgo(30),
      due_date: daysAgo(0),
      memo: "January–February consulting — Weekly Attendance Report (multi-campus) and Record Insights Donor Analysis dashboard.",
      subtotal: 2062.50,
      tax_rate: 0,
      tax_amount: 0,
      total: 2062.50,
      amount_paid: 2062.50,
      sent_at: tsAgo(30),
      viewed_at: tsAgo(28),
    },
    {
      // INV-1003: HSC batch 1 — New member automation + Training → PAID
      client_id: hsc,
      invoice_number: "INV-1003",
      status: "paid",
      issue_date: daysAgo(30),
      due_date: daysAgo(0),
      memo: "January–February consulting — New Member Follow-Up Automation workflow and Group Life staff training.",
      subtotal: 1925.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 1925.00,
      amount_paid: 1925.00,
      sent_at: tsAgo(30),
      viewed_at: tsAgo(27),
    },
    {
      // INV-1004: FBM — Contribution statements → SENT, OVERDUE
      client_id: fbm,
      invoice_number: "INV-1004",
      status: "sent",
      issue_date: daysAgo(18),
      due_date: daysAgo(12), // ← past due, will be computed as overdue
      memo: "February consulting — Contribution Statements configuration, template customization, and batch generation testing.",
      subtotal: 825.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 825.00,
      amount_paid: 0,
      sent_at: tsAgo(18),
    },
    {
      // INV-1005: NGC — ProPresenter API → VIEWED, not overdue
      client_id: ngc,
      invoice_number: "INV-1005",
      status: "viewed",
      issue_date: daysAgo(18),
      due_date: daysFromNow(12),
      memo: "February consulting — ProPresenter 7 API integration with MinistryPlatform service planning module (custom development).",
      subtotal: 2035.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 2035.00,
      amount_paid: 0,
      sent_at: tsAgo(18),
      viewed_at: tsAgo(14),
    },
    {
      // INV-1006: CCC — Households fix → PAID
      client_id: ccc,
      invoice_number: "INV-1006",
      status: "paid",
      issue_date: daysAgo(22),
      due_date: daysAgo(2),
      memo: "Urgent fix — Households page phone number search lookup failure (2 hours, resolved same day).",
      subtotal: 350.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 350.00,
      amount_paid: 350.00,
      sent_at: tsAgo(22),
      viewed_at: tsAgo(21),
    },
    {
      // INV-1007: NGC — Permissions audit → SENT, not overdue
      client_id: ngc,
      invoice_number: "INV-1007",
      status: "sent",
      issue_date: daysAgo(11),
      due_date: daysFromNow(5),
      memo: "February consulting — User permissions audit and security group restructure (new 6-role model).",
      subtotal: 740.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 740.00,
      amount_paid: 0,
      sent_at: tsAgo(11),
    },
    {
      // INV-1008: FBM — Giving dashboard widget → DRAFT
      client_id: fbm,
      invoice_number: "INV-1008",
      status: "draft",
      issue_date: daysAgo(3),
      due_date: daysFromNow(27),
      memo: "February–March consulting — Custom Online Giving Dashboard widget (MP API integration, real-time metrics, trend sparkline).",
      subtotal: 1350.00,
      tax_rate: 0,
      tax_amount: 0,
      total: 1350.00,
      amount_paid: 0,
    },
  ];

  const invoices = assertOk(
    await admin
      .from("invoices")
      .insert(invoiceRows.map((inv) => ({ ...inv, tenant_id: tenantId })))
      .select("id, invoice_number"),
    "insert invoices"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any as Array<{ id: string; invoice_number: string }>;

  const iid = (num: string) => invoices.find((i) => i.invoice_number === num)!.id;

  const i1001 = iid("INV-1001");
  const i1002 = iid("INV-1002");
  const i1003 = iid("INV-1003");
  const i1004 = iid("INV-1004");
  const i1005 = iid("INV-1005");
  const i1006 = iid("INV-1006");
  const i1007 = iid("INV-1007");
  const i1008 = iid("INV-1008");

  console.log(`     8 invoices created.`);

  // ── Step 6: time entries ──────────────────────────────────────────────────
  console.log("\n6/7  Time entries & invoice line items");

  type TimeEntry = {
    client_id: string;
    task_id: string;
    description: string;
    entry_date: string;
    duration_hours: number;
    hourly_rate: number;
    billable: boolean;
    billed: boolean;
    invoice_id?: string;
  };

  const timeEntryRows: TimeEntry[] = [
    // ── CCC T1: Volunteer page view (6.5h) → INV-1001 ──
    { client_id: ccc, task_id: ccc1, description: "Scoping call and page view design — mapped volunteer fields, group type hierarchy, and background check status columns", entry_date: daysAgo(42), duration_hours: 2.5, hourly_rate: 175, billable: true, billed: true, invoice_id: i1001 },
    { client_id: ccc, task_id: ccc1, description: "Built custom SQL view and MP page configuration — volunteer management view with ministry filter and group type drill-down", entry_date: daysAgo(41), duration_hours: 2.5, hourly_rate: 175, billable: true, billed: true, invoice_id: i1001 },
    { client_id: ccc, task_id: ccc1, description: "Testing and QA with volunteer coordinator, added CSV export action and last-service-date sort default", entry_date: daysAgo(40), duration_hours: 1.5, hourly_rate: 175, billable: true, billed: true, invoice_id: i1001 },

    // ── CCC T2: Recurring giving config (3.5h) → INV-1001 ──
    { client_id: ccc, task_id: ccc2, description: "Configured recurring giving schedules (weekly/bi-weekly/monthly), program and fund code mapping, Stripe webhook endpoint setup", entry_date: daysAgo(38), duration_hours: 2.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1001 },
    { client_id: ccc, task_id: ccc2, description: "Sandbox transaction testing across all schedule types, verified fund allocation accuracy, documented process for admin team", entry_date: daysAgo(37), duration_hours: 1.5, hourly_rate: 175, billable: true, billed: true, invoice_id: i1001 },

    // ── CCC T3: Households fix (2h) → INV-1006 ──
    { client_id: ccc, task_id: ccc3, description: "Diagnosed phone number search failure — traced to JOIN condition change in HouseholdView SQL view introduced in MP v5.4", entry_date: daysAgo(27), duration_hours: 1.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1006 },
    { client_id: ccc, task_id: ccc3, description: "Applied fix, tested all search modes (name / email / phone / address), confirmed with church IT, closed ticket", entry_date: daysAgo(26), duration_hours: 1.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1006 },

    // ── CCC T4: Annual report (2.5h) → UNBILLED ──
    { client_id: ccc, task_id: ccc4, description: "Discovery session with operations team — defined report sections, data sources (attendance, giving, volunteers, groups), and fiscal year parameter", entry_date: daysAgo(5), duration_hours: 1.5, hourly_rate: 175, billable: true, billed: false },
    { client_id: ccc, task_id: ccc4, description: "Built report skeleton with attendance trend and giving summary sections, parameterized by year, placeholder for volunteer hours", entry_date: daysAgo(3), duration_hours: 1.0, hourly_rate: 175, billable: true, billed: false },

    // ── GFC T1: Attendance report (5h) → INV-1002 ──
    { client_id: gfc, task_id: gfc1, description: "Requirements gathering with campus pastors — metrics, 5-campus structure, distribution list, Monday 7am delivery schedule", entry_date: daysAgo(43), duration_hours: 1.5, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },
    { client_id: gfc, task_id: gfc1, description: "Built multi-campus attendance report with YoY comparison columns, first-time visitor counts, and % change calculation", entry_date: daysAgo(42), duration_hours: 2.5, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },
    { client_id: gfc, task_id: gfc1, description: "Configured MP scheduled report distribution (Mon 7am, campus pastors + senior pastor), ran test delivery to confirm receipt", entry_date: daysAgo(41), duration_hours: 1.0, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },

    // ── GFC T2: Donor insights (7.5h) → INV-1002 ──
    { client_id: gfc, task_id: gfc2, description: "Configured Record Insights dashboard — LYBUNT/SYBUNT segments, giving trends by fund, lapsed donor filter (12mo+ no gift)", entry_date: daysAgo(37), duration_hours: 3.0, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },
    { client_id: gfc, task_id: gfc2, description: "Added average gift size by donor segment, 12-month trend sparklines, and read-only shared view for Exec Pastor (aggregated data only)", entry_date: daysAgo(36), duration_hours: 3.0, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },
    { client_id: gfc, task_id: gfc2, description: "Testing with development team, access control verification, configuration documentation for future updates", entry_date: daysAgo(35), duration_hours: 1.5, hourly_rate: 165, billable: true, billed: true, invoice_id: i1002 },

    // ── GFC T3: Giving reconciliation (3.5h) → UNBILLED ──
    { client_id: gfc, task_id: gfc3, description: "Designed reconciliation logic — Pushpay API pull, MP contribution match by amount + date + contact ID, exception flagging rules", entry_date: daysAgo(7), duration_hours: 2.0, hourly_rate: 165, billable: true, billed: false },
    { client_id: gfc, task_id: gfc3, description: "Built exception flagging, tested against 2 weeks of historical data — found 3 unmatched weekend recurring gifts, adding catch-up logic", entry_date: daysAgo(5), duration_hours: 1.5, hourly_rate: 165, billable: true, billed: false },

    // ── GFC T4: SMS workflow (2h) → UNBILLED ──
    { client_id: gfc, task_id: gfc4, description: "Built SMS follow-up workflow — trigger on First Time Guest status, 48hr delay, personalized message with campus pastor name and response link", entry_date: daysAgo(2), duration_hours: 2.0, hourly_rate: 165, billable: true, billed: false },

    // ── HSC T1: New member automation (8h) → INV-1003 ──
    { client_id: hsc, task_id: hsc1, description: "Designed 4-step automation workflow — trigger conditions, delay windows, message templates, and dynamic field insertion strategy", entry_date: daysAgo(44), duration_hours: 2.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1003 },
    { client_id: hsc, task_id: hsc1, description: "Built steps 1 and 2 (welcome email + Group Life text) in MP workflow builder, configured delay timers and template variables", entry_date: daysAgo(43), duration_hours: 3.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1003 },
    { client_id: hsc, task_id: hsc1, description: "Built steps 3 and 4 (volunteer interest + call reminder), end-to-end testing with 5 sample new member records", entry_date: daysAgo(42), duration_hours: 3.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1003 },

    // ── HSC T2: Group life training (3h) → INV-1003 ──
    { client_id: hsc, task_id: hsc2, description: "Delivered 3-hour Group Life module training via Zoom (6 attendees) — group types, enrollment, attendance, health reports, Group Finder. Session recorded.", entry_date: daysAgo(35), duration_hours: 3.0, hourly_rate: 175, billable: true, billed: true, invoice_id: i1003 },

    // ── HSC T3: Missions page view (1.5h) → UNBILLED ──
    { client_id: hsc, task_id: hsc3, description: "Scoping call with missions director — defined field requirements for participant registration, deposit tracking, and passport/medical form status", entry_date: daysAgo(8), duration_hours: 1.5, hourly_rate: 175, billable: true, billed: false },

    // ── HSC T4: Small groups roster export (4h) → UNBILLED ──
    { client_id: hsc, task_id: hsc4, description: "Built group roster export — member contact info, attendance %, optional prayer request section, group leader header, meeting details footer", entry_date: daysAgo(6), duration_hours: 2.0, hourly_rate: 175, billable: true, billed: false },
    { client_id: hsc, task_id: hsc4, description: "Added PDF formatting, per-leader prayer request toggle, group meeting time/location in footer per Jennifer's review feedback", entry_date: daysAgo(5), duration_hours: 2.0, hourly_rate: 175, billable: true, billed: false },

    // ── FBM T1: Contribution statements (5.5h) → INV-1004 ──
    { client_id: fbm, task_id: fbm1, description: "Customized contribution statement template — FBM logo, address, EIN, fund breakdown format per donor type (online vs. cash/check)", entry_date: daysAgo(21), duration_hours: 2.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1004 },
    { client_id: fbm, task_id: fbm1, description: "Configured batch generation process — email vs. print preference logic, tested with 25-record sample, documented admin runbook", entry_date: daysAgo(20), duration_hours: 2.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1004 },
    { client_id: fbm, task_id: fbm1, description: "Full 4,200 household batch run — resolved 3 PDF errors (NULL email contacts), walked David through admin process, confirmed delivery", entry_date: daysAgo(19), duration_hours: 1.5, hourly_rate: 150, billable: true, billed: true, invoice_id: i1004 },

    // ── FBM T2: Giving dashboard widget (9h) → INV-1008 (DRAFT) ──
    { client_id: fbm, task_id: fbm2, description: "Architecture design and MP API authentication — OAuth token flow, rate limiting, 5-minute polling interval strategy", entry_date: daysAgo(14), duration_hours: 2.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1008 },
    { client_id: fbm, task_id: fbm2, description: "Built core widget — today's giving total, MTD vs. budget progress bar, fund breakdown list with percentage indicators", entry_date: daysAgo(13), duration_hours: 3.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1008 },
    { client_id: fbm, task_id: fbm2, description: "Added 30-day trend sparkline (Chart.js), 5-min auto-refresh, error state handling, iframe embed on staff intranet homepage", entry_date: daysAgo(12), duration_hours: 3.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1008 },
    { client_id: fbm, task_id: fbm2, description: "Cross-browser testing, performance review, handoff documentation and API key rotation instructions for IT team", entry_date: daysAgo(11), duration_hours: 1.0, hourly_rate: 150, billable: true, billed: true, invoice_id: i1008 },

    // ── NGC T1: ProPresenter integration (11h) → INV-1005 ──
    { client_id: ngc, task_id: ngc1, description: "API research — MP service planning module endpoints, ProPresenter 7 JSON import schema, OAuth authentication design", entry_date: daysAgo(23), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1005 },
    { client_id: ngc, task_id: ngc1, description: "Built MP→ProPresenter data mapper — service order items to slide deck structure, scripture reference lookup and formatting", entry_date: daysAgo(22), duration_hours: 4.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1005 },
    { client_id: ngc, task_id: ngc1, description: "Webhook trigger on MP service finalization, retry logic for transient failures, admin re-sync UI with last-sync timestamp", entry_date: daysAgo(21), duration_hours: 3.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1005 },
    { client_id: ngc, task_id: ngc1, description: "End-to-end testing with live ProPresenter 7 install, 23-item service run, edge case handling, production deployment", entry_date: daysAgo(20), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1005 },

    // ── NGC T2: Permissions audit (4h) → INV-1007 ──
    { client_id: ngc, task_id: ngc2, description: "Full MP user audit — exported all 94 accounts, security groups, and permission assignments. Identified 12 over-privileged accounts.", entry_date: daysAgo(14), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1007 },
    { client_id: ngc, task_id: ngc2, description: "Implemented 6-role structure (Admin, Finance, Ministry Leader, Group Leader, Check-In Staff, Read Only), updated 28 accounts, delivered role matrix doc", entry_date: daysAgo(12), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: true, invoice_id: i1007 },

    // ── NGC T3: Kiosk check-in widget (6h) → UNBILLED ──
    { client_id: ngc, task_id: ngc3, description: "Touchscreen UI design — household lookup flow, child selection grid, express check-in mode. Mockups reviewed and approved by Lisa.", entry_date: daysAgo(5), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: false },
    { client_id: ngc, task_id: ngc3, description: "MP Family Check-In API integration — household lookup by phone, child record retrieval, badge generation payload, Dymo SDK printing", entry_date: daysAgo(4), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: false },
    { client_id: ngc, task_id: ngc3, description: "Offline queue with IndexedDB, sync-on-reconnect logic, 5-minute outage simulation test — all queued check-ins synced successfully", entry_date: daysAgo(3), duration_hours: 2.0, hourly_rate: 185, billable: true, billed: false },
  ];

  const teResult = assertOk(
    await admin
      .from("time_entries")
      .insert(timeEntryRows.map((te) => ({ ...te, tenant_id: tenantId })))
      .select("id, invoice_id, duration_hours, hourly_rate, description"),
    "insert time entries"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any as Array<{
    id: string;
    invoice_id: string | null;
    duration_hours: number;
    hourly_rate: number;
    description: string;
  }>;

  // Invoice line items: one per billed time entry
  const lineItemRows = teResult
    .filter((te) => te.invoice_id !== null)
    .map((te, i) => ({
      tenant_id: tenantId,
      invoice_id: te.invoice_id,
      time_entry_id: te.id,
      description:
        te.description.length > 100
          ? te.description.slice(0, 97) + "..."
          : te.description,
      quantity: Number(te.duration_hours),
      unit_price: Number(te.hourly_rate),
      amount: Number(te.duration_hours) * Number(te.hourly_rate),
      sort_order: i,
    }));

  const { error: liError } = await admin.from("invoice_line_items").insert(lineItemRows);
  if (liError) { console.error("  ❌ insert line items:", liError); process.exit(1); }

  console.log(`     ${teResult.length} time entries created.`);
  console.log(`     ${lineItemRows.length} invoice line items created.`);

  // ── Payments ─────────────────────────────────────────────────────────────
  const paymentRows = [
    { invoice_id: i1001, amount: 1750.00, payment_date: daysAgo(10), payment_method: "ACH",   notes: "Covenant Community ACH transfer — ref #20260121-CCC" },
    { invoice_id: i1002, amount: 2062.50, payment_date: daysAgo(5),  payment_method: "Check", notes: "Grace Fellowship check #8847" },
    { invoice_id: i1003, amount: 1925.00, payment_date: daysAgo(4),  payment_method: "ACH",   notes: "Hillside Church ACH — received from operations account" },
    { invoice_id: i1006, amount: 350.00,  payment_date: daysAgo(16), payment_method: "Check", notes: "Covenant Community check #2293 — urgent fix billing" },
  ];

  const { error: pmtError } = await admin
    .from("payments")
    .insert(paymentRows.map((p) => ({ ...p, tenant_id: tenantId })));
  if (pmtError) { console.error("  ❌ insert payments:", pmtError); process.exit(1); }

  // ── Step 7: comments ──────────────────────────────────────────────────────
  console.log("\n7/7  Task comments");

  const commentRows = [
    {
      task_id: ccc1,
      body: "Page view is live! The volunteer coordinator confirmed all fields display correctly and the CSV export works well — she ran a test export for the full worship team. Ministry filter is intuitive and fast.",
      created_at: tsAgo(40),
      updated_at: tsAgo(40),
    },
    {
      task_id: ccc3,
      body: "Root cause: MP v5.4 renamed the PhoneNumber lookup field in HouseholdView. Fixed the SQL JOIN condition. Tested all four search modes (name, email, phone, address) — all confirmed working by church IT. No other views affected.",
      created_at: tsAgo(25),
      updated_at: tsAgo(25),
    },
    {
      task_id: gfc2,
      body: "Dashboard live and shared with the development team. The Exec Pastor shared view uses a read-only projection that excludes individual donor names — shows aggregated fund totals and segment counts only. LYBUNT/SYBUNT definitions use MP's standard 12-month rolling window.",
      created_at: tsAgo(34),
      updated_at: tsAgo(34),
    },
    {
      task_id: gfc3,
      body: "Reconciliation logic tested against Feb 10–24 Pushpay exports. Found 3 unmatched transactions — all recurring gifts that processed on Saturdays when the MP import job wasn't running. Adding a weekend catch-up pass to the nightly job.",
      created_at: tsAgo(5),
      updated_at: tsAgo(5),
    },
    {
      task_id: hsc1,
      body: "Automation live and confirmed with 5 real new member records from last Sunday. All 4 steps firing with correct delays. Jennifer confirmed she can edit the message templates directly in the MP workflow UI without needing to contact me.",
      created_at: tsAgo(42),
      updated_at: tsAgo(42),
    },
    {
      task_id: hsc4,
      body: "Submitted PDF sample to Jennifer for review. She requested two changes: (1) prayer request section should be per-leader toggle — some leaders don't want this, (2) footer should include the group meeting time and location. Both changes in progress.",
      created_at: tsAgo(5),
      updated_at: tsAgo(5),
    },
    {
      task_id: fbm1,
      body: "Full 4,200 household batch completed successfully. Three PDF errors were caused by contacts with NULL email + print=false — added a null-check guard. David walked through the process and confirmed he can run future batches independently.",
      created_at: tsAgo(18),
      updated_at: tsAgo(18),
    },
    {
      task_id: ngc1,
      body: "Integration live in production. Tech director ran a complete Sunday service through the pipeline — all 23 service items imported to ProPresenter correctly, including scripture references. Manual re-sync UI is at /admin/propresenter. Webhook fires within 30 seconds of MP service finalization.",
      created_at: tsAgo(22),
      updated_at: tsAgo(22),
    },
    {
      task_id: ngc3,
      body: "Express check-in flow working well in iPad testing. Household lookup by phone is fast (< 200ms). Offline queue implemented using IndexedDB — tested 5-minute simulated outage and all queued check-ins synced correctly on reconnect. Starting on badge print error handling next.",
      created_at: tsAgo(3),
      updated_at: tsAgo(3),
    },
  ];

  const { error: cmtError } = await admin.from("comments").insert(
    commentRows.map((c) => ({
      ...c,
      tenant_id: tenantId,
      author_id: userId,
      author_role: "admin",
    }))
  );
  if (cmtError) { console.error("  ❌ insert comments:", cmtError); process.exit(1); }

  console.log(`     ${commentRows.length} comments created.`);

  // ── Done ─────────────────────────────────────────────────────────────────

  const unbilledHours = timeEntryRows
    .filter((te) => !te.billed)
    .reduce((sum, te) => sum + te.duration_hours, 0);

  const unbilledRevenue = timeEntryRows
    .filter((te) => !te.billed)
    .reduce((sum, te) => sum + te.duration_hours * te.hourly_rate, 0);

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           ✅ Demo account created successfully!                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Login                                                           ║
║    Email:     sampleuser@example.com                             ║
║    Password:  sampleuser                                         ║
╠══════════════════════════════════════════════════════════════════╣
║  Business:    Apex Ministry Solutions (Austin, TX)               ║
╠══════════════════════════════════════════════════════════════════╣
║  Clients (5 large churches)                                      ║
║    CCC  Covenant Community Church — Houston TX  @ $175/hr        ║
║    GFC  Grace Fellowship Church  — Atlanta GA   @ $165/hr        ║
║    HSC  Hillside Church          — Denver CO    @ $175/hr        ║
║    FBM  First Baptist Metropolis — Dallas TX    @ $150/hr        ║
║    NGC  Northgate Church         — Seattle WA   @ $185/hr        ║
╠══════════════════════════════════════════════════════════════════╣
║  Tasks (18 total)                                                ║
║    11 closed   4 in_progress   1 in_review   2 backlog           ║
╠══════════════════════════════════════════════════════════════════╣
║  Invoices (8 total)                                              ║
║    INV-1001  CCC  $1,750.00  PAID                                ║
║    INV-1002  GFC  $2,062.50  PAID                                ║
║    INV-1003  HSC  $1,925.00  PAID                                ║
║    INV-1004  FBM    $825.00  SENT → OVERDUE (12 days past due)   ║
║    INV-1005  NGC  $2,035.00  VIEWED (due in 12 days)             ║
║    INV-1006  CCC    $350.00  PAID                                ║
║    INV-1007  NGC    $740.00  SENT (due in 5 days)                ║
║    INV-1008  FBM  $1,350.00  DRAFT                               ║
╠══════════════════════════════════════════════════════════════════╣
║  Unbilled work in progress                                       ║
║    ${unbilledHours.toFixed(1)}h across 6 open tasks — $${unbilledRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })} potential revenue          ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});

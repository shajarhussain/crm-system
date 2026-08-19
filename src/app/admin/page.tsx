"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useEmployees } from "@/hooks/useEmployees";
import { useFinancials } from "@/hooks/useFinancials";
import { LeadCard } from "@/components/LeadCard";
import { Modal } from "@/components/ui/Modal";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import {
  assignLead, reassignLeadManual, addExpense, EXPENSE_CATEGORIES,
  createEmployee, setEmployeePriority, disableEmployee, enableEmployee,
} from "@/lib/clientActions";
import { LEAD_STATUS_LABELS, TERMINAL_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { formatMoney, formatNegativeMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { resolveRange, formatBusinessDate, RANGE_LABELS, type RangeKey } from "@/lib/dates";
import {
  buildEmployeeMetrics, buildCampaignMetrics, rankEmployees, RANKING_OPTIONS, type RankingKey,
} from "@/lib/metrics";
import {
  Search, Users, BarChart3, LayoutDashboard, Receipt, Filter, Plus,
  DollarSign, ShieldCheck, AlertTriangle, FileText, TrendingDown, Wallet,
} from "lucide-react";

type Tab = "PIPELINE" | "DEALS" | "EMPLOYEES" | "EXPENSES" | "REPORTS";

const PIPELINE_STATUSES: LeadStatus[] = [
  "ASSIGNED", "ACCEPTED", "CONTACTED", "FOLLOW_UP", "INTERESTED", "NEGOTIATION", "NO_RESPONSE",
];

export default function AdminDashboard() {
  const { user, role, loading: authLoading, logout, getIdToken } = useAuth();
  const router = useRouter();

  const isAdmin = role === "admin";
  const { leads, loading: leadsLoading, error: leadsError } = useLeads(isAdmin ? "admin" : null);
  const { employees, error: employeesError } = useEmployees(isAdmin);

  const [rangeKey, setRangeKey] = useState<RangeKey>("MONTH");
  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const { deals, expenses, allDeals, totals } = useFinancials(range, isAdmin);

  const [activeTab, setActiveTab] = useState<Tab>("PIPELINE");
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [campaignFilter, setCampaignFilter] = useState("ALL");

  const [assigningLead, setAssigningLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.replace("/");
  }, [user, isAdmin, authLoading, router]);

  const employeeName = useCallback(
    (uid: string | null | undefined) => employees.find((e) => e.uid === uid)?.name,
    [employees]
  );

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      if (lead.campaignId) map.set(lead.campaignId, lead.campaignName ?? lead.campaignId);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        const haystack = [lead.name, lead.phone, lead.email, lead.city, lead.campaignName, lead.source]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
      if (employeeFilter === "UNASSIGNED" && lead.assignedUserId) return false;
      if (employeeFilter !== "ALL" && employeeFilter !== "UNASSIGNED" && lead.assignedUserId !== employeeFilter) return false;
      if (campaignFilter !== "ALL" && lead.campaignId !== campaignFilter) return false;
      return true;
    });
  }, [leads, searchQuery, statusFilter, employeeFilter, campaignFilter]);

  const employeeMetrics = useMemo(
    () => buildEmployeeMetrics(employees, leads, allDeals, range),
    [employees, leads, allDeals, range]
  );
  const campaignMetrics = useMemo(
    () => buildCampaignMetrics(leads, allDeals, range),
    [leads, allDeals, range]
  );

  if (authLoading || (isAdmin && leadsLoading)) return <FullPageSpinner />;
  if (!user || !isAdmin) return null;

  const newLeads = filteredLeads.filter((l) => l.status === "NEW");
  const strandedLeads = filteredLeads.filter((l) => l.status === "UNASSIGNED_NO_CAPACITY");
  const activeLeads = filteredLeads.filter((l) => PIPELINE_STATUSES.includes(l.status));
  const closedLeads = filteredLeads.filter((l) => TERMINAL_STATUSES.includes(l.status));

  const runAction = async (fn: () => Promise<{ ok: boolean; error?: string }>, successText: string) => {
    setBanner(null);
    try {
      const result = await fn();
      if (result.ok) setBanner({ tone: "success", text: successText });
      else setBanner({ tone: "error", text: result.error ?? "That did not work." });
      return result.ok;
    } catch {
      setBanner({ tone: "error", text: "Could not reach the server. Check your connection." });
      return false;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-600/30">
                <ShieldCheck size={20} />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">CRM Admin</h1>
            </div>

            <nav className="hidden items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-950 p-1 md:flex">
              <NavTab active={activeTab === "PIPELINE"} onClick={() => setActiveTab("PIPELINE")} icon={LayoutDashboard} label="Pipeline" />
              <NavTab active={activeTab === "DEALS"} onClick={() => setActiveTab("DEALS")} icon={FileText} label={`Deal entries (${deals.length})`} />
              <NavTab active={activeTab === "EMPLOYEES"} onClick={() => setActiveTab("EMPLOYEES")} icon={Users} label={`Employees (${employees.length})`} />
              <NavTab active={activeTab === "EXPENSES"} onClick={() => setActiveTab("EXPENSES")} icon={Receipt} label={`Expenses (${expenses.length})`} />
              <NavTab active={activeTab === "REPORTS"} onClick={() => setActiveTab("REPORTS")} icon={BarChart3} label="Reports" />
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <NotificationsPanel getIdToken={getIdToken} />
            <span className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 sm:inline">
              {user.email}
            </span>
            <button onClick={logout} className="text-xs font-bold text-red-400 transition-colors hover:text-red-300">
              Sign out
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 px-4 pb-2 md:hidden">
          <NavTab active={activeTab === "PIPELINE"} onClick={() => setActiveTab("PIPELINE")} icon={LayoutDashboard} label="Pipeline" />
          <NavTab active={activeTab === "DEALS"} onClick={() => setActiveTab("DEALS")} icon={FileText} label="Deals" />
          <NavTab active={activeTab === "EMPLOYEES"} onClick={() => setActiveTab("EMPLOYEES")} icon={Users} label="Team" />
          <NavTab active={activeTab === "EXPENSES"} onClick={() => setActiveTab("EXPENSES")} icon={Receipt} label="Expenses" />
          <NavTab active={activeTab === "REPORTS"} onClick={() => setActiveTab("REPORTS")} icon={BarChart3} label="Reports" />
        </nav>
      </header>

      {/* Filters */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="search"
              placeholder="Search name, phone, email, city, campaign…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectPill label="Period" value={rangeKey} onChange={(v) => setRangeKey(v as RangeKey)} icon={Filter}>
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
                <option key={key} value={key} className="bg-slate-900">{RANGE_LABELS[key]}</option>
              ))}
            </SelectPill>

            <SelectPill label="Status" value={statusFilter} onChange={setStatusFilter}>
              <option value="ALL" className="bg-slate-900">All statuses</option>
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((status) => (
                <option key={status} value={status} className="bg-slate-900">{LEAD_STATUS_LABELS[status]}</option>
              ))}
            </SelectPill>

            <SelectPill label="Employee" value={employeeFilter} onChange={setEmployeeFilter}>
              <option value="ALL" className="bg-slate-900">All employees</option>
              <option value="UNASSIGNED" className="bg-slate-900">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.uid} value={emp.uid} className="bg-slate-900">{emp.name}</option>
              ))}
            </SelectPill>

            {campaigns.length > 0 && (
              <SelectPill label="Campaign" value={campaignFilter} onChange={setCampaignFilter}>
                <option value="ALL" className="bg-slate-900">All campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                ))}
              </SelectPill>
            )}
          </div>
        </div>
      </div>

      {(banner || leadsError || employeesError) && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          {leadsError && <Banner tone="error" text={leadsError} />}
          {employeesError && <Banner tone="error" text={employeesError} />}
          {banner && <Banner tone={banner.tone} text={banner.text} onDismiss={() => setBanner(null)} />}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "PIPELINE" && (
          <div className="space-y-10">
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi label="Revenue" value={formatMoney(totals.totalRevenue)} hint={`${totals.dealCount} deals · ${range.label.toLowerCase()}`} icon={DollarSign} />
              <Kpi label="Payable" value={formatMoney(totals.totalPayable)} hint="Owed out on those deals" icon={Wallet} />
              <Kpi label="Gross profit" value={formatMoney(totals.grossProfit)} hint="Revenue − payable" icon={BarChart3} />
              <Kpi label="Expenses" value={formatNegativeMoney(totals.totalExpenses)} hint={`${totals.expenseCount} entries`} icon={TrendingDown} tone="negative" />
              <Kpi label="Net profit" value={formatMoney(totals.netProfit)} hint="Gross profit − expenses" icon={DollarSign} tone={totals.netProfit >= 0 ? "positive" : "negative"} />
            </section>

            {strandedLeads.length > 0 && (
              <LeadSection
                title="Needs manual assignment"
                subtitle="Nobody was available, or every employee let the window lapse."
                tone="critical"
                leads={strandedLeads}
                actionText="Assign"
                onLeadClick={setAssigningLead}
                employeeName={employeeName}
              />
            )}

            <LeadSection
              title="Waiting for assignment"
              subtitle="Assign within 5 minutes, or the rotation takes over."
              tone={newLeads.length > 0 ? "urgent" : "default"}
              leads={newLeads}
              actionText="Assign now"
              onLeadClick={setAssigningLead}
              employeeName={employeeName}
              emptyText="No leads waiting."
            />

            <LeadSection
              title="Active pipeline"
              subtitle="Open the card for the full history and deal entry."
              leads={activeLeads}
              actionText="View"
              onLeadClick={setViewingLead}
              employeeName={employeeName}
              emptyText="No active leads match your filters."
            />

            {closedLeads.length > 0 && (
              <LeadSection
                title="Closed"
                leads={closedLeads}
                actionText="View"
                onLeadClick={setViewingLead}
                employeeName={employeeName}
              />
            )}
          </div>
        )}

        {activeTab === "DEALS" && <DealsLedger deals={deals} employeeName={employeeName} rangeLabel={range.label} />}

        {activeTab === "EMPLOYEES" && (
          <EmployeesTab
            metrics={employeeMetrics}
            getIdToken={getIdToken}
            runAction={runAction}
          />
        )}

        {activeTab === "EXPENSES" && (
          <ExpensesTab expenses={expenses} total={totals.totalExpenses} getIdToken={getIdToken} runAction={runAction} rangeLabel={range.label} />
        )}

        {activeTab === "REPORTS" && (
          <ReportsTab employeeMetrics={employeeMetrics} campaignMetrics={campaignMetrics} rangeLabel={range.label} />
        )}
      </main>

      <AssignModal
        key={assigningLead?.id ?? "none"}
        lead={assigningLead}
        employees={employees}
        onClose={() => setAssigningLead(null)}
        getIdToken={getIdToken}
        runAction={runAction}
      />

      <LeadDetailModal
        key={viewingLead?.id ?? "none"}
        lead={viewingLead}
        onClose={() => setViewingLead(null)}
        userRole="admin"
        getIdToken={getIdToken}
        assigneeName={employeeName(viewingLead?.assignedUserId)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
    </div>
  );
}

function NavTab({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: typeof Users; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
        active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-900 hover:text-white"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function SelectPill({ label, value, onChange, children, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; icon?: typeof Filter;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5">
      {Icon && <Icon size={13} className="text-slate-400" />}
      <span className="font-semibold text-slate-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="cursor-pointer bg-transparent font-semibold text-white outline-none"
      >
        {children}
      </select>
    </div>
  );
}

function Banner({ tone, text, onDismiss }: { tone: "error" | "success"; text: string; onDismiss?: () => void }) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 rounded-xl border p-3 text-xs font-medium ${
      tone === "error"
        ? "border-red-500/20 bg-red-500/10 text-red-300"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    }`}>
      <span className="flex items-start gap-2">
        {tone === "error" && <AlertTriangle size={15} className="mt-px shrink-0" />}
        {text}
      </span>
      {onDismiss && <button onClick={onDismiss} className="shrink-0 font-bold opacity-70 hover:opacity-100">Dismiss</button>}
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone = "default" }: {
  label: string; value: string; hint: string; icon: typeof DollarSign;
  tone?: "default" | "positive" | "negative";
}) {
  const valueColor =
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-white";
  return (
    <div className="space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <Icon size={15} />
      </div>
      <p className={`text-2xl font-black tabular-nums tracking-tight ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function LeadSection({
  title, subtitle, leads, actionText, onLeadClick, employeeName, emptyText, tone = "default",
}: {
  title: string; subtitle?: string; leads: Lead[]; actionText: string;
  onLeadClick: (lead: Lead) => void; employeeName: (uid?: string | null) => string | undefined;
  emptyText?: string; tone?: "default" | "urgent" | "critical";
}) {
  const badgeColor =
    tone === "critical" ? "border-red-500/30 bg-red-500/20 text-red-400"
      : "border-amber-500/30 bg-amber-500/20 text-amber-400";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          {title}
          {leads.length > 0 && tone !== "default" && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badgeColor}`}>{leads.length}</span>
          )}
          {tone === "default" && <span className="text-sm font-normal text-slate-500">({leads.length})</span>}
        </h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      {leads.length === 0 ? (
        emptyText && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              actionText={actionText}
              assigneeName={employeeName(lead.assignedUserId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Deal entries ledger — the permanent record of every closed customer         */
/* -------------------------------------------------------------------------- */

function DealsLedger({ deals, employeeName, rangeLabel }: {
  deals: ReturnType<typeof useFinancials>["deals"];
  employeeName: (uid?: string | null) => string | undefined;
  rangeLabel: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Deal entries</h2>
        <p className="text-xs text-slate-400">
          Every closed customer, with the details captured at the point of sale — {rangeLabel.toLowerCase()}.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
          No deals recorded in this period.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Sold</th>
                  <th className="px-5 py-4">Closed by</th>
                  <th className="px-5 py-4 text-right">Received</th>
                  <th className="px-5 py-4 text-right">Payable</th>
                  <th className="px-5 py-4 text-right">Profit</th>
                  <th className="px-5 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => setExpanded(expanded === deal.id ? null : deal.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{deal.customer?.name ?? "—"}</p>
                      {expanded === deal.id && (
                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                          {deal.customer?.cnic && <p>CNIC: {deal.customer.cnic}</p>}
                          {deal.customer?.address && <p>{deal.customer.address}</p>}
                          {deal.customer?.city && <p>{deal.customer.city}</p>}
                          {deal.paymentMethod && <p>Paid by {deal.paymentMethod}</p>}
                          {deal.notes && <p className="italic">{deal.notes}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-300">
                      {deal.customer?.phone ? formatPhone(deal.customer.phone) : "—"}
                      {deal.customer?.email && <p className="text-[11px] text-slate-500">{deal.customer.email}</p>}
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-slate-300">
                      <p className={expanded === deal.id ? "" : "truncate"}>{deal.serviceDescription ?? "—"}</p>
                      {deal.campaignName && <p className="text-[11px] text-slate-500">{deal.campaignName}</p>}
                    </td>
                    <td className="px-5 py-4 text-slate-300">{employeeName(deal.userId) ?? "—"}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-white">{formatMoney(deal.amountReceived)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-400">{formatMoney(deal.payableAmount)}</td>
                    <td className={`px-5 py-4 text-right font-bold tabular-nums ${deal.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatMoney(deal.profit)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-400">
                      {formatBusinessDate(deal.dealDate ?? deal.enteredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
            Click a row for the full customer record.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type RunAction = (fn: () => Promise<{ ok: boolean; error?: string }>, successText: string) => Promise<boolean>;

function EmployeesTab({ metrics, getIdToken, runAction }: {
  metrics: ReturnType<typeof buildEmployeeMetrics>;
  getIdToken: () => Promise<string>;
  runAction: RunAction;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [priority, setPriority] = useState("1");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await runAction(
      async () => createEmployee(await getIdToken(), { name, email, password, priority: Number(priority) }),
      `${name} can now sign in.`
    );
    if (ok) {
      setIsOpen(false); setName(""); setEmail(""); setPassword(""); setPriority("1");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Employees</h2>
          <p className="text-xs text-slate-400">Priority 1 is highest. The rotation gives each employee eight leads before moving down.</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-indigo-700"
        >
          <Plus size={16} /> Add employee
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4 text-right">Handled</th>
                <th className="px-5 py-4 text-right">Missed</th>
                <th className="px-5 py-4 text-right">Closed</th>
                <th className="px-5 py-4 text-right">Profit</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No employees yet.</td></tr>
              )}
              {metrics.map((emp) => (
                <tr key={emp.uid} className="transition-colors hover:bg-slate-800/40">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{emp.name}</p>
                    <p className="text-[11px] text-slate-500">{emp.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={emp.priority}
                      aria-label={`Priority for ${emp.name}`}
                      onChange={async (e) => {
                        await runAction(
                          async () => setEmployeePriority(await getIdToken(), emp.uid, Number(e.target.value)),
                          `${emp.name} moved to priority ${e.target.value}.`
                        );
                      }}
                      className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold text-white outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-300">{emp.assigned}</td>
                  <td className={`px-5 py-4 text-right font-semibold tabular-nums ${emp.missed > 0 ? "text-red-400" : "text-slate-500"}`}>{emp.missed}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-400">{emp.closedWon}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-white">{formatMoney(emp.profit)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                      emp.status === "ACTIVE"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400"
                    }`}>
                      {emp.status === "ACTIVE" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {emp.status === "ACTIVE" ? (
                      <button
                        onClick={async () => {
                          if (!confirm(`Disable ${emp.name}? They will be signed out and stop receiving leads. Their records are kept.`)) return;
                          await runAction(
                            async () => disableEmployee(await getIdToken(), emp.uid),
                            `${emp.name} disabled. Reassign their open leads.`
                          );
                        }}
                        className="font-bold text-red-400 transition-colors hover:text-red-300"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await runAction(
                            async () => enableEmployee(await getIdToken(), emp.uid),
                            `${emp.name} can sign in again.`
                          );
                        }}
                        className="font-bold text-emerald-400 transition-colors hover:text-emerald-300"
                      >
                        Re-enable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Add employee">
        <form onSubmit={create} className="space-y-4">
          <LabelledInput label="Full name" required value={name} onChange={setName} placeholder="e.g. Ayesha Khan" />
          <LabelledInput label="Email" type="email" required value={email} onChange={setEmail} placeholder="ayesha@company.com" autoComplete="off" />
          <LabelledInput label="Temporary password" type="password" required value={password} onChange={setPassword} hint="At least 8 characters" autoComplete="new-password" />
          <div className="space-y-1">
            <label htmlFor="new-priority" className="block text-xs font-semibold text-slate-700">Rotation priority</label>
            <select
              id="new-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <option key={p} value={p}>Priority {p}{p === 1 ? " (highest)" : ""}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create employee"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ExpensesTab({ expenses, total, getIdToken, runAction, rangeLabel }: {
  expenses: ReturnType<typeof useFinancials>["expenses"];
  total: number;
  getIdToken: () => Promise<string>;
  runAction: RunAction;
  rangeLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Marketing");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await runAction(
      async () => addExpense(await getIdToken(), { title, category, amount: Number(amount), description, date }),
      "Expense recorded."
    );
    if (ok) { setIsOpen(false); setTitle(""); setAmount(""); setDescription(""); }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Expenses</h2>
          <p className="text-xs text-slate-400">
            {rangeLabel} — {formatMoney(total)} across {expenses.length} entries. Deducted from gross profit.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          <Plus size={16} /> Log expense
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        {expenses.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No expenses in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="transition-colors hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-semibold text-white">{expense.title}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">{expense.category}</span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-red-400">{formatNegativeMoney(expense.amount)}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-400">{expense.description || "—"}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-400">{formatBusinessDate(expense.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Log expense">
        <form onSubmit={submit} className="space-y-4">
          <LabelledInput label="Title" required value={title} onChange={setTitle} placeholder="e.g. Meta Ads — August" />
          <div className="space-y-1">
            <label htmlFor="exp-category" className="block text-xs font-semibold text-slate-700">Category</label>
            <select
              id="exp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <LabelledInput label="Amount (PKR)" type="number" required value={amount} onChange={setAmount} placeholder="125000" min="0" step="1" />
          <LabelledInput label="Date" type="date" value={date} onChange={setDate} />
          <div className="space-y-1">
            <label htmlFor="exp-desc" className="block text-xs font-semibold text-slate-700">Description</label>
            <textarea
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Invoice number, supplier, anything worth keeping"
              className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Record expense"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReportsTab({ employeeMetrics, campaignMetrics, rangeLabel }: {
  employeeMetrics: ReturnType<typeof buildEmployeeMetrics>;
  campaignMetrics: ReturnType<typeof buildCampaignMetrics>;
  rangeLabel: string;
}) {
  const [rankBy, setRankBy] = useState<RankingKey>("profit");
  const ranked = useMemo(() => rankEmployees(employeeMetrics, rankBy), [employeeMetrics, rankBy]);
  const best = ranked[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Performance &amp; campaigns</h2>
          <p className="text-xs text-slate-400">{rangeLabel}</p>
        </div>
        <SelectPill label="Rank by" value={rankBy} onChange={(v) => setRankBy(v as RankingKey)}>
          {RANKING_OPTIONS.map((option) => (
            <option key={option.key} value={option.key} className="bg-slate-900">{option.label}</option>
          ))}
        </SelectPill>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">#</th>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4 text-right">Handled</th>
                <th className="px-5 py-4 text-right">Accepted</th>
                <th className="px-5 py-4 text-right">Missed</th>
                <th className="px-5 py-4 text-right">Follow-ups</th>
                <th className="px-5 py-4 text-right">Calls</th>
                <th className="px-5 py-4 text-right">Closed</th>
                <th className="px-5 py-4 text-right">Revenue</th>
                <th className="px-5 py-4 text-right">Profit</th>
                <th className="px-5 py-4 text-right">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ranked.length === 0 && (
                <tr><td colSpan={11} className="px-5 py-8 text-center text-slate-500">No employee data for this period.</td></tr>
              )}
              {ranked.map((emp, index) => (
                <tr key={emp.uid} className={`transition-colors hover:bg-slate-800/40 ${emp.status === "DISABLED" ? "opacity-50" : ""}`}>
                  <td className="px-5 py-4 font-bold tabular-nums text-slate-500">{index + 1}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{emp.name}</p>
                    <p className="text-[11px] text-slate-500">Priority {emp.priority}</p>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-300">{emp.assigned}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-300">{emp.accepted}</td>
                  <td className={`px-5 py-4 text-right tabular-nums ${emp.missed > 0 ? "text-red-400" : "text-slate-500"}`}>{emp.missed}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-300">{emp.followUps}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-300">{emp.calls}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-400">{emp.closedWon}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-300">{formatMoney(emp.revenue)}</td>
                  <td className="px-5 py-4 text-right font-bold tabular-nums text-white">{formatMoney(emp.profit)}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-indigo-400">{emp.conversionRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {best && best.assigned > 0 && (
          <p className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
            Leading on {RANKING_OPTIONS.find((o) => o.key === rankBy)?.label.toLowerCase()}: <span className="font-semibold text-slate-300">{best.name}</span>
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-bold text-white">Campaign performance</h3>
          <p className="text-xs text-slate-400">Which ads are actually paying for themselves.</p>
        </div>
        {campaignMetrics.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No campaign data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">Campaign</th>
                  <th className="px-5 py-4 text-right">Leads</th>
                  <th className="px-5 py-4 text-right">Closed</th>
                  <th className="px-5 py-4 text-right">Conv.</th>
                  <th className="px-5 py-4 text-right">Revenue</th>
                  <th className="px-5 py-4 text-right">Profit</th>
                  <th className="px-5 py-4 text-right">Value / lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {campaignMetrics.map((campaign) => (
                  <tr key={campaign.campaignId} className="transition-colors hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-semibold text-white">{campaign.name}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-300">{campaign.leads}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-emerald-400">{campaign.closedWon}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-indigo-400">{campaign.conversionRate.toFixed(1)}%</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-300">{formatMoney(campaign.revenue)}</td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-white">{formatMoney(campaign.profit)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-400">{formatMoney(campaign.valuePerLead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AssignModal({ lead, employees, onClose, getIdToken, runAction }: {
  lead: Lead | null;
  employees: ReturnType<typeof useEmployees>["employees"];
  onClose: () => void;
  getIdToken: () => Promise<string>;
  runAction: RunAction;
}) {
  // Remounted per lead via a key from the caller, so selection resets on its own.
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  if (!lead) return null;

  const active = employees.filter((e) => e.status === "ACTIVE");
  const isFirstAssignment = lead.status === "NEW" || lead.status === "UNASSIGNED_NO_CAPACITY";

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    const chosen = employees.find((e) => e.uid === selected);
    const ok = await runAction(
      async () => {
        const token = await getIdToken();
        return isFirstAssignment
          ? assignLead(token, lead.id, selected)
          : reassignLeadManual(token, lead.id, selected);
      },
      `${lead.name} assigned to ${chosen?.name ?? "employee"}. They have 10 minutes to accept.`
    );
    if (ok) onClose();
    setBusy(false);
  };

  return (
    <Modal isOpen onClose={onClose} title={isFirstAssignment ? "Assign lead" : "Reassign lead"}>
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">Lead</p>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
            <p className="font-bold text-slate-900">{lead.name}</p>
            {lead.phone && <p className="text-xs tabular-nums text-slate-500">{formatPhone(lead.phone)}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="assignee" className="block text-xs font-semibold text-slate-600">Assign to</label>
          {active.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              There are no active employees. Add or re-enable someone first.
            </p>
          ) : (
            <select
              id="assignee"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Choose an employee…</option>
              {active.map((emp) => (
                <option key={emp.uid} value={emp.uid}>{emp.name} — priority {emp.priority}</option>
              ))}
            </select>
          )}
        </div>

        <button
          disabled={!selected || busy}
          onClick={submit}
          className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Assigning…" : "Confirm assignment"}
        </button>
      </div>
    </Modal>
  );
}

function LabelledInput({
  label, value, onChange, type = "text", required, placeholder, hint, min, step, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  required?: boolean; placeholder?: string; hint?: string; min?: string; step?: string; autoComplete?: string;
}) {
  const id = `field-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 font-normal text-slate-400">— {hint}</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        min={min}
        step={step}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

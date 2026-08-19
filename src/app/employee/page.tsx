"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useMyDeals } from "@/hooks/useFinancials";
import { LeadCard } from "@/components/LeadCard";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { acceptLead } from "@/lib/clientActions";
import { LEAD_STATUS_LABELS, TERMINAL_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { formatMoney } from "@/lib/money";
import { resolveRange, RANGE_LABELS, type RangeKey } from "@/lib/dates";
import { Search, Filter, Briefcase, CheckCircle, Clock, UserCheck, AlertTriangle, DollarSign } from "lucide-react";

export default function EmployeeDashboard() {
  const { user, role, loading: authLoading, logout, getIdToken } = useAuth();
  const router = useRouter();

  const isEmployee = role === "employee";
  const { leads, loading: leadsLoading, error } = useLeads(isEmployee ? "employee" : null, user?.uid);

  const [rangeKey, setRangeKey] = useState<RangeKey>("MONTH");
  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const { totals: myTotals } = useMyDeals(isEmployee ? user?.uid : undefined, range);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isEmployee)) router.replace("/");
  }, [user, isEmployee, authLoading, router]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        const haystack = [lead.name, lead.phone, lead.email, lead.city].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
      return true;
    });
  }, [leads, searchQuery, statusFilter]);

  if (authLoading || (isEmployee && leadsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user || !isEmployee) return null;

  const awaitingAcceptance = filteredLeads.filter((l) => l.status === "ASSIGNED");
  const working = filteredLeads.filter(
    (l) => !TERMINAL_STATUSES.includes(l.status) && l.status !== "ASSIGNED"
  );
  const closed = filteredLeads.filter((l) => TERMINAL_STATUSES.includes(l.status));

  const handleAccept = async (lead: Lead) => {
    setAcceptingId(lead.id);
    setBanner(null);
    try {
      const result = await acceptLead(await getIdToken(), lead.id);
      if (result.ok) {
        setBanner({ tone: "success", text: `${lead.name} is yours. Log your first follow-up soon.` });
      } else {
        setBanner({ tone: "error", text: result.error });
      }
    } catch {
      setBanner({ tone: "error", text: "Could not reach the server. Check your connection." });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-600/30">
              <Briefcase size={20} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">My workspace</h1>
              <p className="text-[11px] text-slate-400">Leads, follow-ups and deals</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 sm:inline">
              {user.email}
            </span>
            <button onClick={logout} className="text-xs font-bold text-red-400 transition-colors hover:text-red-300">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="search"
              placeholder="Search my leads by name, phone, email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5">
              <Filter size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="cursor-pointer bg-transparent font-semibold text-white outline-none"
              >
                <option value="ALL" className="bg-slate-900">All my leads</option>
                {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[])
                  .filter((s) => s !== "NEW" && s !== "UNASSIGNED_NO_CAPACITY")
                  .map((status) => (
                    <option key={status} value={status} className="bg-slate-900">{LEAD_STATUS_LABELS[status]}</option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5">
              <span className="font-semibold text-slate-400">Period:</span>
              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value as RangeKey)}
                aria-label="Reporting period"
                className="cursor-pointer bg-transparent font-semibold text-white outline-none"
              >
                {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
                  <option key={key} value={key} className="bg-slate-900">{RANGE_LABELS[key]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-300">
            <AlertTriangle size={15} className="mt-px shrink-0" /> {error}
          </div>
        )}

        {banner && (
          <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs font-medium ${
            banner.tone === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}>
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="shrink-0 font-bold opacity-70 hover:opacity-100">Dismiss</button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Needs acceptance" value={awaitingAcceptance.length} hint="10-minute window" icon={Clock} tone="amber" />
          <StatTile label="Working" value={working.length} hint="Leads in progress" icon={UserCheck} tone="default" />
          <StatTile label="Closed won" value={closed.filter((l) => l.status === "CLOSED_WON").length} hint="Converted" icon={CheckCircle} tone="emerald" />
          <StatTile label="My profit" value={formatMoney(myTotals.profit)} hint={`${myTotals.count} deals · ${RANGE_LABELS[rangeKey].toLowerCase()}`} icon={DollarSign} tone="emerald" />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              Needs acceptance
              {awaitingAcceptance.length > 0 && (
                <span className="animate-pulse rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-0.5 text-xs text-red-400">
                  {awaitingAcceptance.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">Accept within 10 minutes or the lead passes to someone else.</p>
          </div>

          {awaitingAcceptance.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center text-xs text-slate-500">
              Nothing waiting for you right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {awaitingAcceptance.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => handleAccept(lead)}
                  actionText={acceptingId === lead.id ? "Accepting…" : "Accept lead"}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-white">My pipeline ({working.length})</h2>
            <p className="text-xs text-slate-400">Open a card to log calls, message on WhatsApp, or record a deal.</p>
          </div>

          {working.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center text-xs text-slate-500">
              No leads in progress.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {working.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} actionText="Open" />
              ))}
            </div>
          )}
        </section>

        {closed.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white">Closed ({closed.length})</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {closed.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} actionText="View" />
              ))}
            </div>
          </section>
        )}
      </main>

      <LeadDetailModal
        key={selectedLead?.id ?? "none"}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        userRole="employee"
        getIdToken={getIdToken}
      />
    </div>
  );
}

function StatTile({ label, value, hint, icon: Icon, tone }: {
  label: string; value: number | string; hint: string;
  icon: typeof Clock; tone: "default" | "amber" | "emerald";
}) {
  const valueColor =
    tone === "amber" ? "text-amber-400" : tone === "emerald" ? "text-emerald-400" : "text-white";
  const border = tone === "emerald" ? "border-emerald-500/30" : "border-slate-800";

  return (
    <div className={`space-y-1 rounded-2xl border bg-slate-900 p-6 ${border}`}>
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <p className={`text-3xl font-black tabular-nums tracking-tight ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

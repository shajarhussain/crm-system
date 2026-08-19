"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/hooks/useLeads";
import { useLeadHistory } from "@/hooks/useLeads";
import { useDealForLead } from "@/hooks/useFinancials";
import { addFollowUp, setLeadStatus, closeDeal, PAYMENT_METHODS } from "@/lib/clientActions";
import { USER_SETTABLE_STATUSES, LEAD_STATUS_LABELS, isTerminal, type LeadStatus } from "@/lib/leadStatus";
import { whatsAppUrl, telUrl, formatPhone } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/dates";
import {
  Phone, Mail, MessageCircle, Clock, Tag, Plus, DollarSign,
  History, User, Activity, AlertTriangle, CheckCircle2, MapPin, X,
} from "lucide-react";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  userRole: "admin" | "employee";
  getIdToken: () => Promise<string>;
  assigneeName?: string;
}

type Tab = "FOLLOW_UPS" | "AUDIT_TRAIL" | "DEAL_ENTRY";

/** Today in Asia/Karachi, as the yyyy-mm-dd a date input expects. */
function todayInputValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

export function LeadDetailModal({ lead, onClose, userRole, getIdToken, assigneeName }: LeadDetailModalProps) {
  const { followUps, events, error: historyError } = useLeadHistory(lead?.id ?? null);
  const { deal } = useDealForLead(lead?.id ?? null);
  // The caller keys this component by lead id, so opening a different lead
  // remounts it and both of these start fresh without a reset effect.
  const [activeTab, setActiveTab] = useState<Tab>("FOLLOW_UPS");
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!lead) return null;

  const waUrl = whatsAppUrl(lead.phone);
  const callUrl = telUrl(lead.phone);
  const closed = isTerminal(lead.status);
  const canEnterDeal = !closed && lead.status !== "ASSIGNED" && lead.status !== "NEW";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Lead: ${lead.name}`}
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 p-6 text-white">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-2xl font-bold tracking-tight">{lead.name}</h2>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <Tag size={13} /> Source: <span className="text-slate-300">{lead.source}</span>
              {lead.campaignName && (
                <span>• Campaign: <span className="text-slate-300">{lead.campaignName}</span></span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-500"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {callUrl && (
              <a
                href={callUrl}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700"
              >
                <Phone size={15} /> Call
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-2 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Intake warning — a lead Meta gave us without contact details */}
        {lead.intakeWarning && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-900">
            <AlertTriangle size={15} className="mt-px shrink-0" />
            <span>
              Contact details could not be retrieved from Meta for this lead. Check that the
              Meta page access token is configured.
            </span>
          </div>
        )}

        {/* Info strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1">
              <Phone size={14} className="text-slate-400" />
              {lead.phone ? formatPhone(lead.phone) : <span className="text-amber-600">No number</span>}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1"><Mail size={14} className="text-slate-400" /> {lead.email}</span>
            )}
            {lead.city && (
              <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400" /> {lead.city}</span>
            )}
            <span className="flex items-center gap-1">
              <User size={14} className="text-slate-400" />
              {lead.assignedUserId ? (assigneeName ?? "Assigned") : "Unassigned"}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} className="text-slate-400" /> {formatBusinessDateTime(lead.createdAt)}
            </span>
          </div>

          <StatusSelect
            lead={lead}
            disabled={closed}
            getIdToken={getIdToken}
            onResult={setBanner}
          />
        </div>

        {banner && (
          <div
            className={`px-6 py-2.5 text-xs font-medium ${
              banner.tone === "error"
                ? "border-b border-red-200 bg-red-50 text-red-700"
                : "border-b border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <TabButton active={activeTab === "FOLLOW_UPS"} onClick={() => setActiveTab("FOLLOW_UPS")}>
            <History size={16} /> Follow-ups ({followUps.length})
          </TabButton>
          <TabButton active={activeTab === "AUDIT_TRAIL"} onClick={() => setActiveTab("AUDIT_TRAIL")}>
            <Activity size={16} /> Audit trail ({events.length})
          </TabButton>
          <TabButton
            active={activeTab === "DEAL_ENTRY"}
            onClick={() => setActiveTab("DEAL_ENTRY")}
            tone={deal ? "success" : "default"}
          >
            <DollarSign size={16} /> {deal ? "Deal record" : "Deal entry"}
          </TabButton>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-6">
          {historyError && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{historyError}</p>
          )}

          {activeTab === "FOLLOW_UPS" && (
            <FollowUpsTab
              lead={lead}
              followUps={followUps}
              getIdToken={getIdToken}
              onResult={setBanner}
            />
          )}

          {activeTab === "AUDIT_TRAIL" && <AuditTrailTab events={events} />}

          {activeTab === "DEAL_ENTRY" && (
            deal ? (
              <DealRecordView deal={deal} />
            ) : canEnterDeal ? (
              <DealEntryForm
                lead={lead}
                userRole={userRole}
                getIdToken={getIdToken}
                onResult={setBanner}
                onDone={() => setActiveTab("FOLLOW_UPS")}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                {closed
                  ? "This lead is closed and has no deal entry."
                  : "Accept this lead and start working it before entering a deal."}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, children, tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "success";
}) {
  const activeColor = tone === "success" ? "border-emerald-600 text-emerald-600" : "border-indigo-600 text-indigo-600";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
        active ? activeColor : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

function StatusSelect({
  lead, disabled, getIdToken, onResult,
}: {
  lead: Lead;
  disabled: boolean;
  getIdToken: () => Promise<string>;
  onResult: (b: { tone: "error" | "success"; text: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (next: string) => {
    if (!next || next === lead.status) return;
    setBusy(true);
    onResult(null);
    try {
      const result = await setLeadStatus(await getIdToken(), lead.id, next as LeadStatus);
      if (!result.ok) onResult({ tone: "error", text: result.error });
    } catch {
      onResult({ tone: "error", text: "Could not reach the server. Check your connection." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="lead-status" className="font-semibold text-slate-700">Status:</label>
      <select
        id="lead-status"
        value={USER_SETTABLE_STATUSES.includes(lead.status) ? lead.status : ""}
        disabled={disabled || busy}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        <option value="" disabled>
          {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
        </option>
        {USER_SETTABLE_STATUSES.map((status) => (
          <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>
        ))}
      </select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-ups (FR-14, FR-15, BR-13/BR-14)                                      */
/* -------------------------------------------------------------------------- */

function FollowUpsTab({
  lead, followUps, getIdToken, onResult,
}: {
  lead: Lead;
  followUps: ReturnType<typeof useLeadHistory>["followUps"];
  getIdToken: () => Promise<string>;
  onResult: (b: { tone: "error" | "success"; text: string } | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [callMade, setCallMade] = useState(false);
  const [callCount, setCallCount] = useState("1");
  const [whatsappNote, setWhatsappNote] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setBusy(true);
    onResult(null);
    try {
      const result = await addFollowUp(await getIdToken(), lead.id, {
        message: message.trim(),
        callMade,
        callCount: Number(callCount) || 1,
        whatsappNote: whatsappNote.trim(),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      });

      if (result.ok) {
        setMessage(""); setCallMade(false); setCallCount("1");
        setWhatsappNote(""); setOccurredAt(""); setShowForm(false);
        onResult({ tone: "success", text: "Follow-up saved." });
      } else {
        onResult({ tone: "error", text: result.error });
      }
    } catch {
      onResult({ tone: "error", text: "Could not reach the server. Check your connection." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Communication log</h3>
          <p className="text-xs text-slate-500">
            Entries are permanent. To correct something, add a new follow-up rather than changing an old one.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            <Plus size={15} /> Add follow-up
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">New follow-up</span>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>

          <Field label="What happened?" required htmlFor="fu-message">
            <textarea
              id="fu-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Summary of the conversation, what the customer wants, and the next step…"
              className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={callMade}
                  onChange={(e) => setCallMade(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                Call was made
              </label>
              {callMade && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Calls:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={callCount}
                    onChange={(e) => setCallCount(e.target.value)}
                    aria-label="Number of calls"
                    className="w-14 rounded border bg-white px-2 py-0.5 text-center text-xs font-bold tabular-nums"
                  />
                </div>
              )}
            </div>

            <Field label="When did this happen?" htmlFor="fu-when" hint="Leave blank for right now">
              <input
                id="fu-when"
                type="datetime-local"
                value={occurredAt}
                max={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>

          <Field label="WhatsApp note" htmlFor="fu-wa" hint="What you sent, if anything">
            <input
              id="fu-wa"
              type="text"
              value={whatsappNote}
              onChange={(e) => setWhatsappNote(e.target.value)}
              placeholder="e.g. Sent price list and location pin"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save follow-up"}
            </button>
          </div>
        </form>
      )}

      {followUps.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageCircle className="mx-auto text-slate-400" size={32} />
          <p className="text-sm font-semibold text-slate-700">No follow-ups yet.</p>
          <p className="text-xs text-slate-400">Log every call and message so the history stays complete.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {followUps.map((fu, index) => (
            <div key={fu.id} className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">Touch #{followUps.length - index}</span>
                  <span className="text-slate-400">• {fu.authorEmail ?? "Team member"}</span>
                </div>
                <span className="tabular-nums text-slate-400">
                  {formatBusinessDateTime(fu.occurredAt ?? fu.createdAt)}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm text-slate-800">{fu.message}</p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {fu.callMade && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                    <Phone size={12} /> Called{fu.callCount && fu.callCount > 1 ? ` ${fu.callCount}×` : ""}
                  </span>
                )}
                {fu.whatsappNote && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    <MessageCircle size={12} /> {fu.whatsappNote}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit trail (FR-29)                                                         */
/* -------------------------------------------------------------------------- */

const EVENT_LABELS: Record<string, string> = {
  LEAD_INGESTED: "Lead received from Meta",
  MANUALLY_ASSIGNED: "Assigned by admin",
  AUTO_ASSIGNED: "Auto-assigned by rotation",
  MANUALLY_REASSIGNED: "Reassigned by admin",
  AUTO_REASSIGNED: "Reassigned automatically",
  LEAD_ACCEPTED: "Accepted by employee",
  EXPIRED: "Acceptance window expired",
  AUTO_ASSIGN_FAILED: "No employee available",
  STATUS_CHANGED: "Status changed",
  FOLLOW_UP_ADDED: "Follow-up logged",
  DEAL_CLOSED: "Deal closed",
};

function AuditTrailTab({ events }: { events: ReturnType<typeof useLeadHistory>["events"] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Audit trail</h3>
        <p className="text-xs text-slate-500">Every automated and manual event on this lead, newest first.</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
          No events recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {events.map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-4 p-4 text-xs">
              <div className="min-w-0 space-y-1">
                <span className="font-bold text-slate-900">{EVENT_LABELS[event.type] ?? event.type}</span>
                <p className="text-slate-500">
                  {event.actorUid?.startsWith("system") ? "System" : "By " + event.actorUid.slice(0, 8)}
                </p>
                {event.meta && Object.keys(event.meta).length > 0 && (
                  <div className="overflow-x-auto rounded border bg-slate-50 p-2 text-[11px] text-slate-600">
                    {Object.entries(event.meta).map(([key, value]) => (
                      <div key={key} className="whitespace-nowrap">
                        <span className="text-slate-400">{key}:</span> {String(value ?? "—")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="whitespace-nowrap tabular-nums text-slate-400">
                {formatBusinessDateTime(event.at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Entry Module (FR-20, FR-21, BR-18, BR-19)                                   */
/* -------------------------------------------------------------------------- */

function DealEntryForm({
  lead, userRole, getIdToken, onResult, onDone,
}: {
  lead: Lead;
  userRole: "admin" | "employee";
  getIdToken: () => Promise<string>;
  onResult: (b: { tone: "error" | "success"; text: string } | null) => void;
  onDone: () => void;
}) {
  // Prefilled from the lead, because what a customer typed into an ad form is
  // rarely what belongs in a permanent record. The employee confirms it here.
  const [name, setName] = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(lead.city ?? "");
  const [serviceDescription, setServiceDescription] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [payableAmount, setPayableAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [dealDate, setDealDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const received = Number(amountReceived);
  const payable = Number(payableAmount);
  const profit =
    Number.isFinite(received) && Number.isFinite(payable) && amountReceived !== "" && payableAmount !== ""
      ? received - payable
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onResult(null);
    try {
      const result = await closeDeal(await getIdToken(), lead.id, {
        customer: { name, phone, email, cnic, address, city },
        serviceDescription,
        amountReceived: Number(amountReceived),
        payableAmount: Number(payableAmount),
        paymentMethod,
        dealDate,
        notes,
      });

      if (result.ok) {
        onResult({
          tone: "success",
          text: `Deal recorded. Profit ${formatMoney(result.data.profit)}.`,
        });
        onDone();
      } else {
        onResult({ tone: "error", text: result.error });
      }
    } catch {
      onResult({ tone: "error", text: "Could not reach the server. Check your connection." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-md">
      <div className="space-y-1 border-b border-slate-100 pb-3 text-center">
        <h3 className="text-lg font-bold text-slate-900">Deal entry</h3>
        <p className="text-xs text-slate-500">
          Confirm the customer&apos;s details and record the amounts. This closes the lead as won
          and cannot be edited afterwards, so check it before saving.
        </p>
      </div>

      <section className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer record</h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required htmlFor="d-name">
            <TextInput id="d-name" required value={name} onChange={setName} placeholder="e.g. Ahmed Raza" />
          </Field>
          <Field label="Contact number" required htmlFor="d-phone" hint="Any local format works">
            <TextInput id="d-phone" required value={phone} onChange={setPhone} placeholder="0300 1234567" inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="d-email">
            <TextInput id="d-email" type="email" value={email} onChange={setEmail} placeholder="optional" />
          </Field>
          <Field label="CNIC" htmlFor="d-cnic" hint="Optional">
            <TextInput id="d-cnic" value={cnic} onChange={setCnic} placeholder="00000-0000000-0" />
          </Field>
          <Field label="City" htmlFor="d-city">
            <TextInput id="d-city" value={city} onChange={setCity} placeholder="e.g. Lahore" />
          </Field>
          <Field label="Address" htmlFor="d-address">
            <TextInput id="d-address" value={address} onChange={setAddress} placeholder="optional" />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">What was sold</h4>

        <Field label="Description" required htmlFor="d-service">
          <textarea
            id="d-service"
            required
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            placeholder="Property, package or service the customer bought"
            className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Amounts</h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount received (PKR)" required htmlFor="d-received">
            <TextInput id="d-received" required type="number" min="0" step="1" value={amountReceived} onChange={setAmountReceived} placeholder="850000" />
          </Field>
          <Field label="Payable amount (PKR)" required htmlFor="d-payable" hint="What goes back out">
            <TextInput id="d-payable" required type="number" min="0" step="1" value={payableAmount} onChange={setPayableAmount} placeholder="500000" />
          </Field>
          <Field label="Payment method" htmlFor="d-method">
            <select
              id="d-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </Field>
          <Field label="Deal date" htmlFor="d-date">
            <TextInput id="d-date" type="date" value={dealDate} max={todayInputValue()} onChange={setDealDate} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Profit</span>
          <span className="text-xl font-extrabold tabular-nums text-emerald-700">
            {profit === null ? "—" : formatMoney(profit)}
          </span>
        </div>
        {profit !== null && profit < 0 && (
          <p className="text-xs font-medium text-amber-700">
            This deal is recorded at a loss. Save it only if that is correct.
          </p>
        )}

        <Field label="Notes" htmlFor="d-notes">
          <textarea
            id="d-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else worth keeping on the record"
            className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </section>

      {userRole === "admin" && (
        <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
          Recorded against the employee this lead is assigned to, not your account.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save deal and close lead"}
      </button>
    </form>
  );
}

function DealRecordView({ deal }: { deal: NonNullable<ReturnType<typeof useDealForLead>["deal"]> }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-emerald-200 bg-white p-6 shadow-md">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <CheckCircle2 className="text-emerald-600" size={20} />
        <div>
          <h3 className="text-base font-bold text-slate-900">Deal closed</h3>
          <p className="text-xs text-slate-500">Recorded {formatBusinessDate(deal.dealDate ?? deal.enteredAt)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Detail label="Customer" value={deal.customer?.name} />
        <Detail label="Contact" value={deal.customer?.phone ? formatPhone(deal.customer.phone) : null} />
        <Detail label="Email" value={deal.customer?.email} />
        <Detail label="CNIC" value={deal.customer?.cnic} />
        <Detail label="City" value={deal.customer?.city} />
        <Detail label="Address" value={deal.customer?.address} />
        <Detail label="Payment method" value={deal.paymentMethod} />
      </dl>

      {deal.serviceDescription && (
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">What was sold</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{deal.serviceDescription}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
        <Money label="Received" value={deal.amountReceived} />
        <Money label="Payable" value={deal.payableAmount} />
        <Money label="Profit" value={deal.profit} emphasis />
      </div>

      {deal.notes && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{deal.notes}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                         */
/* -------------------------------------------------------------------------- */

function Field({
  label, children, required, htmlFor, hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 font-normal text-slate-400">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  id, value, onChange, placeholder, type = "text", required, min, step, max, inputMode,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  max?: string;
  inputMode?: "tel" | "numeric" | "text";
}) {
  return (
    <input
      id={id}
      type={type}
      required={required}
      min={min}
      max={max}
      step={step}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
    />
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function Money({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${emphasis ? "text-emerald-700" : "text-slate-900"}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

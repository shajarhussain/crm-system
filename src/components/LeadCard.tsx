"use client";

import { useEffect, useState } from "react";
import { Clock, User, ArrowRight, AlertTriangle, Phone } from "lucide-react";
import type { Lead } from "@/hooks/useLeads";
import { LEAD_STATUS_LABELS } from "@/lib/leadStatus";
import { formatPhone } from "@/lib/phone";
import { formatBusinessDate } from "@/lib/dates";

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  actionText?: string;
  /** Display name for the assigned employee, when the caller knows it. */
  assigneeName?: string;
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  ASSIGNED: "bg-amber-50 text-amber-700 border-amber-200",
  ACCEPTED: "bg-violet-50 text-violet-700 border-violet-200",
  CONTACTED: "bg-sky-50 text-sky-700 border-sky-200",
  FOLLOW_UP: "bg-cyan-50 text-cyan-700 border-cyan-200",
  INTERESTED: "bg-teal-50 text-teal-700 border-teal-200",
  NEGOTIATION: "bg-orange-50 text-orange-700 border-orange-200",
  CLOSED_WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED_LOST: "bg-slate-100 text-slate-600 border-slate-200",
  NOT_INTERESTED: "bg-slate-100 text-slate-600 border-slate-200",
  NO_RESPONSE: "bg-slate-100 text-slate-600 border-slate-200",
  UNASSIGNED_NO_CAPACITY: "bg-red-50 text-red-700 border-red-200",
};

export function LeadCard({ lead, onClick, actionText, assigneeName }: LeadCardProps) {
  const countdown = useCountdown(lead);

  const statusStyle = STATUS_STYLES[lead.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const isOverdue = countdown?.expired ?? false;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        onClick ? "cursor-pointer hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg" : ""
      } ${isOverdue ? "border-red-300" : "border-slate-200"}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-semibold tracking-tight text-slate-900">{lead.name}</h4>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <User size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {lead.assignedUserId ? (assigneeName ?? "Assigned") : "Unassigned"}
            </span>
          </p>
          {lead.phone ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Phone size={12} className="shrink-0" />
              <span className="tabular-nums">{formatPhone(lead.phone)}</span>
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <AlertTriangle size={12} className="shrink-0" />
              No contact number
            </p>
          )}
        </div>

        <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
          {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
        </span>
      </div>

      {lead.campaignName && (
        <p className="mb-3 truncate text-xs text-slate-400">Campaign: {lead.campaignName}</p>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        {countdown ? (
          <div
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums ${
              countdown.expired ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
            }`}
          >
            <Clock size={14} />
            <span>{countdown.expired ? "Window closed" : `${countdown.display} left`}</span>
          </div>
        ) : (
          <div className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-400">
            {formatBusinessDate(lead.createdAt)}
          </div>
        )}

        {onClick && actionText && (
          <div className="flex items-center gap-1 text-sm font-bold text-indigo-600 group-hover:text-indigo-700">
            {actionText}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Live countdown for whichever SLA window applies (BR-4, BR-7).
 *
 * "Window closed" is shown rather than a negative number: once the deadline
 * passes the lead is queued for the next sweep, so the action is no longer
 * available even though the card is still on screen.
 */
function useCountdown(lead: Lead) {
  const deadlineMs =
    lead.status === "NEW"
      ? (lead.adminAssignDeadlineAt?.toMillis?.() ?? null)
      : lead.status === "ASSIGNED"
        ? (lead.acceptDeadlineAt?.toMillis?.() ?? null)
        : null;

  // The effect only advances a clock; the display is derived during render.
  // Computing the first frame inside the effect instead would set state
  // synchronously on mount and cause a cascading re-render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineMs) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  if (!deadlineMs) return null;

  const remaining = deadlineMs - now;
  if (remaining <= 0) return { display: "0:00", expired: true };

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { display: `${minutes}:${String(seconds).padStart(2, "0")}`, expired: false };
}

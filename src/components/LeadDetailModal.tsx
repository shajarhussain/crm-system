"use client";

import { useState } from "react";
import { Lead, LeadStatus, useLeadHistory } from "@/hooks/useLeads";
import { Modal } from "@/components/ui/Modal";
import { addFollowUp } from "@/app/actions/followUps";
import { setLeadStatus } from "@/app/actions/leads";
import { closeDeal } from "@/app/actions/closedDeals";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Tag, 
  Plus, 
  DollarSign, 
  History, 
  User,
  Activity,
  Layers
} from "lucide-react";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  userRole: "admin" | "employee";
  getIdToken: () => Promise<string>;
}

const ALL_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "FOLLOW_UP", label: "Follow-Up" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "CLOSED_WON", label: "Closed / Won" },
  { value: "CLOSED_LOST", label: "Closed / Lost" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "NO_RESPONSE", label: "No Response" },
];

export function LeadDetailModal({ lead, onClose, userRole, getIdToken }: LeadDetailModalProps) {
  const { followUps, events, loading: historyLoading } = useLeadHistory(lead?.id || null);

  const [activeTab, setActiveTab] = useState<"FOLLOW_UPS" | "AUDIT_TRAIL" | "CLOSE_DEAL">("FOLLOW_UPS");

  // Follow-up form state
  const [showAddFu, setShowAddFu] = useState(false);
  const [fuMessage, setFuMessage] = useState("");
  const [fuCallMade, setFuCallMade] = useState(false);
  const [fuCallCount, setFuCallCount] = useState("1");
  const [fuWhatsappNote, setFuWhatsappNote] = useState("");
  const [isSubmittingFu, setIsSubmittingFu] = useState(false);

  // Status state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Close deal state
  const [amountReceived, setAmountReceived] = useState("");
  const [payableAmount, setPayableAmount] = useState("");
  const [isClosingDeal, setIsClosingDeal] = useState(false);

  if (!lead) return null;

  const cleanPhone = lead.phone?.replace(/[^0-9]/g, "") || "";
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setIsUpdatingStatus(true);
    try {
      const token = await getIdToken();
      await setLeadStatus(token, lead.id, newStatus);
    } catch (e: any) {
      alert("Error updating status: " + e.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuMessage.trim()) return;

    setIsSubmittingFu(true);
    try {
      const token = await getIdToken();
      await addFollowUp(
        token,
        lead.id,
        fuMessage.trim(),
        fuCallMade,
        fuWhatsappNote.trim(),
        parseInt(fuCallCount) || 1
      );
      setFuMessage("");
      setFuCallMade(false);
      setFuCallCount("1");
      setFuWhatsappNote("");
      setShowAddFu(false);
    } catch (e: any) {
      alert("Error adding follow-up: " + e.message);
    } finally {
      setIsSubmittingFu(false);
    }
  };

  const handleCloseDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountReceived || !payableAmount) return;

    setIsClosingDeal(true);
    try {
      const token = await getIdToken();
      await closeDeal(
        token, 
        lead.id, 
        parseFloat(amountReceived), 
        parseFloat(payableAmount)
      );
      setAmountReceived("");
      setPayableAmount("");
      setActiveTab("FOLLOW_UPS");
    } catch (e: any) {
      alert("Error closing deal: " + e.message);
    } finally {
      setIsClosingDeal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Lead Profile */}
        <div className="p-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white">{lead.name}</h2>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {lead.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Tag size={13} /> Source: <span className="text-slate-300">{lead.source}</span>
              {lead.campaignId && <span>• Campaign: <span className="text-slate-300 font-mono">{lead.campaignId}</span></span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Click-to-Chat Button (BR-11 / FR-17) */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}

            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors"
              >
                <Phone size={15} /> Call
              </a>
            )}

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Info Strip */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            {lead.phone && <span className="flex items-center gap-1"><Phone size={14} className="text-slate-400" /> {lead.phone}</span>}
            {lead.email && <span className="flex items-center gap-1"><Mail size={14} className="text-slate-400" /> {lead.email}</span>}
            <span className="flex items-center gap-1"><User size={14} className="text-slate-400" /> {lead.assignedUserId ? `Assigned: ${lead.assignedUserId.substring(0, 8)}` : "Unassigned"}</span>
            <span className="flex items-center gap-1"><Clock size={14} className="text-slate-400" /> Intake: {lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleString() : "Recent"}</span>
          </div>

          {/* Status Changer (FR-13) */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Update Status:</span>
            <select
              value={lead.status}
              disabled={isUpdatingStatus}
              onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              {ALL_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab("FOLLOW_UPS")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === "FOLLOW_UPS" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <History size={16} /> Follow-Up History ({followUps.length})
          </button>
          <button
            onClick={() => setActiveTab("AUDIT_TRAIL")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === "AUDIT_TRAIL" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <Activity size={16} /> Audit Trail ({events.length})
          </button>
          {lead.status !== "CLOSED_WON" && (
            <button
              onClick={() => setActiveTab("CLOSE_DEAL")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === "CLOSE_DEAL" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              <DollarSign size={16} /> Close Deal Entry
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* TAB 1: FOLLOW UPS */}
          {activeTab === "FOLLOW_UPS" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Communication Log (Permanent & Immutable)</h3>
                  <p className="text-xs text-slate-500">Per BR-13/BR-14, submitted follow-ups cannot be edited or deleted.</p>
                </div>
                {!showAddFu && (
                  <button
                    onClick={() => setShowAddFu(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-105"
                  >
                    <Plus size={15} /> + Add More Follow-Up
                  </button>
                )}
              </div>

              {/* Add Follow-Up Form (FR-14 / FR-15) */}
              {showAddFu && (
                <form onSubmit={handleAddFollowUp} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">New Follow-Up Entry</span>
                    <button type="button" onClick={() => setShowAddFu(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancel</button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Note / Conversation Message *</label>
                    <textarea
                      required
                      value={fuMessage}
                      onChange={(e) => setFuMessage(e.target.value)}
                      placeholder="Summary of client conversation, interests, and next steps..."
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={fuCallMade}
                          onChange={(e) => setFuCallMade(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        Call Was Made
                      </label>
                      {fuCallMade && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>Count:</span>
                          <input
                            type="number"
                            min="1"
                            value={fuCallCount}
                            onChange={(e) => setFuCallCount(e.target.value)}
                            className="w-12 px-2 py-0.5 bg-white border rounded text-center text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={fuWhatsappNote}
                        onChange={(e) => setFuWhatsappNote(e.target.value)}
                        placeholder="WhatsApp message note (optional)..."
                        className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFu(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingFu}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md"
                    >
                      {isSubmittingFu ? "Submitting..." : "Save Follow-Up"}
                    </button>
                  </div>
                </form>
              )}

              {/* Follow-up Timeline */}
              {followUps.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                  <MessageCircle className="mx-auto text-slate-400" size={32} />
                  <p className="text-sm font-semibold text-slate-700">No follow-ups logged yet.</p>
                  <p className="text-xs text-slate-400">Click "+ Add More Follow-Up" to record calls, notes, or messages.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {followUps.map((fu, idx) => (
                    <div key={fu.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">Touch #{followUps.length - idx}</span>
                          <span className="text-slate-400">• By {fu.authorUid ? fu.authorUid.substring(0, 6) : "User"}</span>
                        </div>
                        <span className="text-slate-400 font-mono">
                          {fu.createdAt?.toDate ? fu.createdAt.toDate().toLocaleString() : "Logged"}
                        </span>
                      </div>

                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{fu.message}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {fu.callMade && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Phone size={12} /> Call Made {fu.callCount && fu.callCount > 1 ? `(${fu.callCount}x)` : ""}
                          </span>
                        )}
                        {fu.whatsappNote && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <MessageCircle size={12} /> WA: {fu.whatsappNote}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUDIT TRAIL */}
          {activeTab === "AUDIT_TRAIL" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Lead Audit Trail (FR-29)</h3>
                <p className="text-xs text-slate-500">Chronological history of all automated and manual system events.</p>
              </div>

              {events.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No audit events recorded for this lead.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {events.map(ev => (
                    <div key={ev.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {ev.type}
                        </span>
                        <p className="text-slate-500">Actor: <span className="font-mono text-slate-700">{ev.actorUid}</span></p>
                        {ev.meta && (
                          <pre className="text-[11px] bg-slate-50 p-2 rounded border text-slate-600 font-mono overflow-x-auto">
                            {JSON.stringify(ev.meta, null, 2)}
                          </pre>
                        )}
                      </div>
                      <span className="text-slate-400 whitespace-nowrap font-mono">
                        {ev.at?.toDate ? ev.at.toDate().toLocaleString() : "Recent"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOSE DEAL */}
          {activeTab === "CLOSE_DEAL" && (
            <form onSubmit={handleCloseDeal} className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-md space-y-5 max-w-lg mx-auto">
              <div className="text-center space-y-1 pb-2 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Close Deal Entry (FR-20 / FR-21)</h3>
                <p className="text-xs text-slate-500">Convert this lead to Closed / Won and record financial amounts.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Received ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payable Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payableAmount}
                    onChange={(e) => setPayableAmount(e.target.value)}
                    placeholder="e.g. 3500"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Calculated Profit</span>
                  <span className="text-xl font-extrabold text-emerald-700">
                    ${(parseFloat(amountReceived || "0") - parseFloat(payableAmount || "0")).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isClosingDeal || !amountReceived || !payableAmount}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-sm transition-all"
              >
                {isClosingDeal ? "Processing..." : "Confirm Closed Deal (Won)"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

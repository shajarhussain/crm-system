"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeads, Lead } from "@/hooks/useLeads";
import { LeadCard } from "@/components/LeadCard";
import { Modal } from "@/components/ui/Modal";
import { acceptLead } from "@/app/actions/leads";
import { addFollowUp } from "@/app/actions/followUps";
import { closeDeal } from "@/app/actions/closedDeals";

export default function EmployeeDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { leads, loading: leadsLoading } = useLeads('employee', user?.uid);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  
  // Follow-up state
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [fuMsg, setFuMsg] = useState("");
  const [fuCall, setFuCall] = useState(false);
  const [isSubmittingFu, setIsSubmittingFu] = useState(false);

  // Close deal state
  const [closeLead, setCloseLead] = useState<Lead | null>(null);
  const [amount, setAmount] = useState("");
  const [payable, setPayable] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "employee")) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  if (loading || leadsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }
  if (!user || role !== "employee") return null;

  const assignedLeads = leads.filter(l => l.status === "ASSIGNED");
  const acceptedLeads = leads.filter(l => l.status === "ACCEPTED");

  const handleAccept = async (leadId: string) => {
    setAcceptingId(leadId);
    try {
      const token = await user.getIdToken();
      await acceptLead(token, leadId);
    } catch (e: any) {
      alert("Error accepting lead: " + e.message);
    } finally {
      setAcceptingId(null);
    }
  };

  const submitFollowUp = async () => {
    if (!followUpLead || !fuMsg) return;
    setIsSubmittingFu(true);
    try {
      const token = await user.getIdToken();
      await addFollowUp(token, followUpLead.id, fuMsg, fuCall, "");
      setFollowUpLead(null);
      setFuMsg("");
      setFuCall(false);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmittingFu(false);
    }
  };

  const submitCloseDeal = async () => {
    if (!closeLead || !amount || !payable) return;
    setIsClosing(true);
    try {
      const token = await user.getIdToken();
      await closeDeal(token, closeLead.id, parseFloat(amount), parseFloat(payable));
      setCloseLead(null);
      setAmount("");
      setPayable("");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-600 tracking-tight">My Workspace</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{user.email}</span>
            <button 
              onClick={() => auth.signOut()}
              className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-12">
        
        {/* New Assignments */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Needs Acceptance
            {assignedLeads.length > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full animate-pulse">{assignedLeads.length}</span>}
          </h2>
          {assignedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500 font-medium">You have no new leads to accept.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => handleAccept(lead.id)}
                  actionText={acceptingId === lead.id ? "Accepting..." : "Accept Lead"}
                />
              ))}
            </div>
          )}
        </section>

        {/* My Pipeline */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6">My Active Pipeline</h2>
          {acceptedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 font-medium">No active leads in your pipeline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {acceptedLeads.map(lead => (
                <div key={lead.id} className="relative group">
                  <LeadCard lead={lead} />
                  <div className="absolute inset-0 bg-gray-900/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                    <button 
                      onClick={() => setFollowUpLead(lead)}
                      className="bg-white text-gray-900 font-semibold px-4 py-2.5 rounded-xl shadow-lg hover:bg-gray-50 transition-transform hover:scale-105"
                    >
                      Follow-up
                    </button>
                    <button 
                      onClick={() => setCloseLead(lead)}
                      className="bg-green-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg hover:bg-green-600 transition-transform hover:scale-105"
                    >
                      Close Deal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal isOpen={!!followUpLead} onClose={() => setFollowUpLead(null)} title="Log Follow-up">
        <div className="space-y-5">
          <textarea
            placeholder="What happened during this follow-up?"
            value={fuMsg}
            onChange={(e) => setFuMsg(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none h-32 resize-none transition-all"
          />
          <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <input type="checkbox" checked={fuCall} onChange={(e) => setFuCall(e.target.checked)} className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
            <span className="text-gray-700 font-medium select-none">Was a call made?</span>
          </label>
          <button
            disabled={!fuMsg || isSubmittingFu}
            onClick={submitFollowUp}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg mt-4 flex justify-center"
          >
            {isSubmittingFu ? "Logging..." : "Save Follow-up"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!closeLead} onClose={() => setCloseLead(null)} title="Close Deal">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount Received ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-900 font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
              placeholder="e.g. 5000"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payable Amount ($)</label>
            <input
              type="number"
              value={payable}
              onChange={(e) => setPayable(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-900 font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
              placeholder="e.g. 4000"
            />
          </div>
          <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 mt-2">
            <p className="text-sm font-medium">Estimated Net Profit</p>
            <p className="text-2xl font-bold tracking-tight">
              ${(parseFloat(amount || '0') - parseFloat(payable || '0')).toFixed(2)}
            </p>
          </div>
          <button
            disabled={!amount || !payable || isClosing}
            onClick={submitCloseDeal}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg mt-4 flex justify-center"
          >
            {isClosing ? "Closing..." : "Confirm & Close Deal"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

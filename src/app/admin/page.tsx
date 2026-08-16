"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useEmployees } from "@/hooks/useEmployees";
import { LeadCard } from "@/components/LeadCard";
import { Modal } from "@/components/ui/Modal";
import { assignLead } from "@/app/actions/leads";

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { leads, loading: leadsLoading } = useLeads('admin');
  const { employees, loading: empLoading } = useEmployees();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  if (loading || leadsLoading || empLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user || role !== "admin") return null;

  const newLeads = leads.filter(l => l.status === "NEW");
  const activeLeads = leads.filter(l => ["ASSIGNED", "ACCEPTED"].includes(l.status));
  const closedLeads = leads.filter(l => l.status === "CLOSED_WON");

  const handleAssign = async () => {
    if (!selectedLead || !selectedEmpId) return;
    setIsAssigning(true);
    try {
      const token = await user.getIdToken();
      await assignLead(token, selectedLead.id, selectedEmpId);
      setSelectedLead(null);
      setSelectedEmpId("");
    } catch (e: any) {
      alert("Error assigning lead: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">Admin Dashboard</h1>
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
        
        {/* KPI Section */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-semibold text-blue-100">Action Required (NEW)</h3>
              <p className="text-4xl font-extrabold mt-2 tracking-tight">{newLeads.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-600">Active Pipeline</h3>
              <p className="text-4xl font-extrabold mt-2 text-gray-900 tracking-tight">{activeLeads.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-600">Deals Won</h3>
              <p className="text-4xl font-extrabold mt-2 text-green-600 tracking-tight">{closedLeads.length}</p>
            </div>
          </div>
        </section>

        {/* Action Required Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Action Required
            {newLeads.length > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{newLeads.length}</span>}
          </h2>
          {newLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 font-medium">No new leads pending assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => setSelectedLead(lead)}
                  actionText="Assign Now"
                />
              ))}
            </div>
          )}
        </section>

        {/* Pipeline Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Active Pipeline</h2>
          {activeLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 font-medium">No active leads being worked on.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
              {activeLeads.map(lead => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title="Assign Lead">
        {selectedLead && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Lead Name</p>
              <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">{selectedLead.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Select Assignee</p>
              <select 
                value={selectedEmpId} 
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="" disabled>Select an employee...</option>
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid}>{emp.email} (Priority: {emp.priority})</option>
                ))}
              </select>
            </div>
            <button
              disabled={!selectedEmpId || isAssigning}
              onClick={handleAssign}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex justify-center items-center"
            >
              {isAssigning ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

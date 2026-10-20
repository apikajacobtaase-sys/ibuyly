// src/app/admin/promotions/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Tag, Plus, CheckCircle, XCircle } from "lucide-react";

interface Voucher {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminPromotionsPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    code: "", description: "", type: "PERCENTAGE", value: "", minOrderAmount: "", usageLimit: ""
  });

  useEffect(() => { fetchVouchers(); }, []);

  const fetchVouchers = async () => {
    try {
      const res = await fetch("/api/admin/promotions");
      const data = await res.json();
      if (res.ok) setVouchers(data.vouchers || []);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/promotions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    if (res.ok) { setShowModal(false); setForm({ code: "", description: "", type: "PERCENTAGE", value: "", minOrderAmount: "", usageLimit: "" }); fetchVouchers(); }
    else { alert((await res.json()).error); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/promotions", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive: !isActive })
    });
    fetchVouchers();
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promotions & Vouchers</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount codes for customers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" /> Create Voucher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {vouchers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Tag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No vouchers created yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Code</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Discount</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Usage</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-mono font-bold text-indigo-600">{v.code}</p>
                    <p className="text-xs text-gray-500">{v.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    {v.type === "PERCENTAGE" ? `${v.value}%` : `GH₵ ${v.value.toFixed(2)}`}
                    {v.minOrderAmount && <p className="text-xs text-gray-500">Min: GH₵ {v.minOrderAmount}</p>}
                  </td>
                  <td className="px-6 py-4">
                    {v.usedCount} {v.usageLimit ? `/ ${v.usageLimit}` : "used"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${v.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {v.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => toggleActive(v.id, v.isActive)} className={`p-1.5 rounded transition ${v.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>
                      {v.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Create New Voucher</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input required placeholder="Code (e.g., SAVE20)" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm uppercase" />
              <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed (GH₵)</option>
                </select>
                <input required type="number" step="0.01" placeholder="Value" value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <input type="number" placeholder="Min Order Amount (Optional)" value={form.minOrderAmount} onChange={e => setForm({...form, minOrderAmount: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="number" placeholder="Usage Limit (Optional)" value={form.usageLimit} onChange={e => setForm({...form, usageLimit: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg font-semibold">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
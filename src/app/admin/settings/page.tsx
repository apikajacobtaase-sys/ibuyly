// src/app/admin/settings/page.tsx
"use client";

import { Settings, Shield, Database, Globe } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Global configuration and system health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Marketplace Config */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Marketplace Configuration</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Seller Commission (%)</label>
              <input type="number" defaultValue="5" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" readOnly />
              <p className="text-xs text-gray-500 mt-1">Applied to new sellers. Existing sellers retain their custom rates.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform Currency</label>
              <input type="text" defaultValue="GHS (Ghanaian Cedi)" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" readOnly />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Maintenance Mode</p>
                <p className="text-xs text-gray-500">Temporarily disable customer checkout</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-900">System Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Database Connection</span>
              <span className="text-xs font-semibold text-green-700">● Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Payment Gateway (Paystack)</span>
              <span className="text-xs font-semibold text-green-700">● Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">Email Service (Resend)</span>
              <span className="text-xs font-semibold text-green-700">● Configured</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">AI Concierge (OpenAI)</span>
              <span className="text-xs font-semibold text-yellow-700">● Fallback Mode</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Security & Compliance</p>
            <p>All administrative actions are permanently recorded in the <strong>Audit Logs</strong>. Database backups are recommended weekly. Ensure your <code>.env</code> secrets are rotated every 90 days in production.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
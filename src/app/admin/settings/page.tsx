 "use client";

import { useEffect, useState } from "react";
import { Settings, Shield, Database, Globe, Loader2, Save } from "lucide-react";

type PlatformSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  expectedBackAt: string | null;
  updatedAt: string | null;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    maintenanceMode: false,
    maintenanceMessage: "",
    expectedBackAt: null,
    updatedAt: null,
  });
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Unable to load settings.");

        if (active) {
          setSettings({
            ...data.settings,
            expectedBackAt: data.settings.expectedBackAt
              ? new Date(data.settings.expectedBackAt).toISOString().slice(0, 16)
              : null,
          });
          setCanManage(data.canManageMaintenance);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();
    return () => { active = false; };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save settings.");

      setSettings({
        ...data.settings,
        expectedBackAt: data.settings.expectedBackAt
          ? new Date(data.settings.expectedBackAt).toISOString().slice(0, 16)
          : null,
      });

      setSuccess("Platform settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Global configuration and system health</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <Globe className="h-6 w-6 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Marketplace Configuration</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default Seller Commission (%)</label>
              <input type="number" defaultValue="5" readOnly className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-gray-500">Existing sellers retain their custom rates.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Platform Currency</label>
              <input type="text" defaultValue="GHS (Ghanaian Cedi)" readOnly className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm" />
            </div>

            <div className={`rounded-lg border p-4 ${settings.maintenanceMode ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Maintenance Mode</p>
                  <p className="mt-1 text-xs text-gray-600">{settings.maintenanceMode ? "Marketplace maintenance is active." : "Marketplace is operating normally."}</p>
                </div>

                <button
                  type="button"
                  disabled={!canManage || loading || saving}
                  onClick={() => setSettings((current) => ({ ...current, maintenanceMode: !current.maintenanceMode }))}
                  aria-label="Toggle maintenance mode"
                  aria-pressed={settings.maintenanceMode}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${settings.maintenanceMode ? "bg-red-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.maintenanceMode ? "left-6" : "left-1"}`} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Visitor-facing message</label>
                  <textarea
                    value={settings.maintenanceMessage ?? ""}
                    onChange={(e) => setSettings((current) => ({ ...current, maintenanceMessage: e.target.value }))}
                    maxLength={500}
                    rows={3}
                    disabled={!canManage || loading || saving}
                    placeholder="We are improving your shopping experience. Please check back shortly."
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">{(settings.maintenanceMessage ?? "").length}/500</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Estimated return time</label>
                  <input
                    type="datetime-local"
                    value={settings.expectedBackAt ?? ""}
                    onChange={(e) => setSettings((current) => ({ ...current, expectedBackAt: e.target.value || null }))}
                    disabled={!canManage || loading || saving}
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                </div>
              </div>

              {!canManage && <p className="mt-3 text-xs text-amber-700">Only Super Admin can modify maintenance settings.</p>}

              {canManage && (
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={loading || saving}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Platform Settings"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <Database className="h-6 w-6 text-green-600" />
            <h3 className="font-semibold text-gray-900">System Health</h3>
          </div>
          <p className="text-sm text-gray-500">Live service health monitoring has not yet been connected.</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="mb-1 font-semibold">Security & Compliance</p>
            <p>Platform maintenance changes are recorded in the audit logs. Only Super Admin can activate or deactivate maintenance mode.</p>
          </div>
        </div>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading platform settings...</div>}
    </div>
  );
}
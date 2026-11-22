 "use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Tag, Plus, CheckCircle, XCircle, Image as ImageIcon,
  Trash2, Edit, Upload, Megaphone, Loader2,
} from "lucide-react";

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
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  altText: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  placement: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
}

const emptyBanner = {
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  altText: "",
  buttonText: "",
  buttonUrl: "",
  placement: "HOME_HERO",
  isActive: true,
  startsAt: "",
  endsAt: "",
  sortOrder: 0,
};

type BannerForm = typeof emptyBanner;

export default function AdminPromotionsPage() {
  const [tab, setTab] = useState<"vouchers" | "banners">("vouchers");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [voucherForm, setVoucherForm] = useState({
    code: "",
    description: "",
    type: "PERCENTAGE",
    value: "",
    minOrderAmount: "",
    usageLimit: "",
  });

  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBanner);

  useEffect(() => {
    Promise.all([fetchVouchers(), fetchBanners()]).finally(() =>
      setLoading(false)
    );
  }, []);

  async function fetchVouchers() {
    const res = await fetch("/api/admin/promotions");
    const data = await res.json();
    if (res.ok) setVouchers(data.vouchers || []);
  }

  async function fetchBanners() {
    const res = await fetch("/api/admin/banners");
    const data = await res.json();
    if (res.ok) setBanners(data.banners || []);
  }

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(voucherForm),
    });

    if (!res.ok) {
      alert((await res.json()).error || "Failed to create voucher");
      return;
    }

    setShowVoucherModal(false);
    setVoucherForm({
      code: "",
      description: "",
      type: "PERCENTAGE",
      value: "",
      minOrderAmount: "",
      usageLimit: "",
    });
    fetchVouchers();
  }

  async function toggleVoucher(id: string, isActive: boolean) {
    const res = await fetch("/api/admin/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });

    if (res.ok) fetchVouchers();
    else alert("Failed to update voucher");
  }

  async function uploadImage(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "imageUrl" | "mobileImageUrl"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setBannerForm((prev) => ({ ...prev, [field]: data.url }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);

    }
  }

  function openNewBanner() {
    setEditingId(null);
    setBannerForm({ ...emptyBanner });
    setShowBannerModal(true);
  }

  function openEditBanner(banner: Banner) {
    setEditingId(banner.id);

    setBannerForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl || "",
      altText: banner.altText || "",
      buttonText: banner.buttonText || "",
      buttonUrl: banner.buttonUrl || "",
      placement: banner.placement,
      isActive: banner.isActive,
      startsAt: banner.startsAt
        ? new Date(banner.startsAt).toISOString().slice(0, 16)
        : "",
      endsAt: banner.endsAt
        ? new Date(banner.endsAt).toISOString().slice(0, 16)
        : "",
      sortOrder: banner.sortOrder,
    });

    setShowBannerModal(true);
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();

    if (!bannerForm.imageUrl) {
      alert("Please upload a desktop banner image.");
      return;
    }

    if (
      bannerForm.startsAt &&
      bannerForm.endsAt &&
      new Date(bannerForm.endsAt) <= new Date(bannerForm.startsAt)
    ) {
      alert("End date must be after start date.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...bannerForm,
        startsAt: bannerForm.startsAt
          ? new Date(bannerForm.startsAt).toISOString()
          : null,
        endsAt: bannerForm.endsAt
          ? new Date(bannerForm.endsAt).toISOString()
          : null,
      };

      const res = await fetch("/api/admin/banners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload
        ),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to save banner");

      setShowBannerModal(false);
      setEditingId(null);
      await fetchBanners();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBanner(banner: Banner) {
    const res = await fetch("/api/admin/banners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: banner.id,
        isActive: !banner.isActive,
      }),
    });

    if (res.ok) fetchBanners();
    else alert("Failed to update banner");
  }

  async function deleteBanner(id: string) {
    if (!confirm("Delete this promotional banner permanently?")) return;

    const res = await fetch("/api/admin/banners", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) fetchBanners();
    else alert((await res.json()).error || "Failed to delete banner");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }
return (
  <div className="min-h-screen w-full space-y-6 overflow-y-auto px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Marketing & Promotions
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage promotional campaigns, banners and customer vouchers.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("vouchers")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 ${
            tab === "vouchers"
              ? "border-green-700 text-green-800"
              : "border-transparent text-gray-500"
          }`}
        >
          <Tag className="inline w-4 h-4 mr-2" />
          Vouchers
        </button>

        <button
          onClick={() => setTab("banners")}
          className={`px-5 py-3 font-semibold text-sm border-b-2 ${
            tab === "banners"
              ? "border-green-700 text-green-800"
              : "border-transparent text-gray-500"
          }`}
        >
          <Megaphone className="inline w-4 h-4 mr-2" />
          Promotional Banners
        </button>
      </div>

      {tab === "vouchers" && (
        <section className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Create and manage customer discount codes.
            </p>
            <button
              onClick={() => setShowVoucherModal(true)}
              className="bg-green-800 text-white px-4 py-2 rounded-lg font-semibold text-sm"
            >
              <Plus className="inline w-4 h-4 mr-1" />
              Create Voucher
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            {vouchers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Tag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                No vouchers created yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Code", "Discount", "Usage", "Status", "Actions"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-5 py-3 text-left text-gray-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vouchers.map((v) => (
                    <tr key={v.id}>
                      <td className="px-5 py-4">
                        <strong className="text-green-800">{v.code}</strong>
                        <p className="text-xs text-gray-500">
                          {v.description}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {v.type === "PERCENTAGE"
                          ? `${v.value}%`
                          : `GH₵ ${v.value.toFixed(2)}`}
                      </td>
                      <td className="px-5 py-4">
                        {v.usedCount} {v.usageLimit ? `/ ${v.usageLimit}` : "used"}
                      </td>
                      <td className="px-5 py-4">
                        {v.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleVoucher(v.id, v.isActive)}
                          className="text-gray-500"
                        >
                          {v.isActive ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-700" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === "banners" && (
        <section className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Manage homepage advertising and promotional banners.
            </p>
            <button
              onClick={openNewBanner}
              className="bg-green-800 text-white px-4 py-2 rounded-lg font-semibold text-sm"
            >
              <Plus className="inline w-4 h-4 mr-1" />
              Create Banner
            </button>
          </div>

          {banners.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center">
              <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h3 className="font-bold text-gray-800">
                No promotional banners yet
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Create your first campaign to advertise on the homepage.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="bg-white border rounded-xl overflow-hidden"
                >
                  <div className="relative aspect-[16/7] bg-gray-100">
                    <Image
                      src={banner.imageUrl}
                      alt={banner.altText || banner.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex justify-between gap-2">
                      <h3 className="font-bold text-gray-900">
                        {banner.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full h-fit ${
                          banner.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {banner.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500">
                      {banner.placement.replaceAll("_", " ")}
                    </p>

                    <p className="text-xs text-gray-500">
                      {banner.startsAt
                        ? `Starts: ${new Date(banner.startsAt).toLocaleString()}`
                        : "Starts immediately"}
                    </p>

                    <div className="flex justify-between border-t pt-3">
                      <button
                        onClick={() => toggleBanner(banner)}
                        className="text-sm text-green-800 font-semibold"
                      >
                        {banner.isActive ? "Deactivate" : "Activate"}
                      </button>

                      <div className="flex gap-3">
                        <button
                          onClick={() => openEditBanner(banner)}
                          className="text-blue-600"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteBanner(banner.id)}
                          className="text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVoucher}
            className="bg-white rounded-xl p-6 max-w-md w-full space-y-4"
          >
            <h3 className="font-bold text-lg">Create Voucher</h3>

            <input
              required
              placeholder="Voucher code"
              value={voucherForm.code}
              onChange={(e) =>
                setVoucherForm({ ...voucherForm, code: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <input
              placeholder="Description"
              value={voucherForm.description}
              onChange={(e) =>
                setVoucherForm({ ...voucherForm, description: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={voucherForm.type}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, type: e.target.value })
                }
                className="border rounded-lg p-3"
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>

              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Value"
                value={voucherForm.value}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, value: e.target.value })
                }
                className="border rounded-lg p-3"
              />
            </div>

            <input
              type="number"
              placeholder="Minimum order amount"
              value={voucherForm.minOrderAmount}
              onChange={(e) =>
                setVoucherForm({
                  ...voucherForm,
                  minOrderAmount: e.target.value,
                })
              }
              className="w-full border rounded-lg p-3"
            />

            <input
              type="number"
              placeholder="Usage limit"
              value={voucherForm.usageLimit}
              onChange={(e) =>
                setVoucherForm({ ...voucherForm, usageLimit: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="flex-1 border rounded-lg py-2"
              >
                Cancel
              </button>
              <button className="flex-1 bg-green-800 text-white rounded-lg py-2">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {showBannerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
          <form
            onSubmit={saveBanner}
            className="bg-white rounded-xl p-6 max-w-2xl w-full space-y-4 my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <h3 className="text-xl font-bold">
              {editingId ? "Edit Promotional Banner" : "Create Promotional Banner"}
            </h3>

            <input
              required
              maxLength={120}
              placeholder="Banner title"
              value={bannerForm.title}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, title: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <input
              maxLength={250}
              placeholder="Subtitle (optional)"
              value={bannerForm.subtitle}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, subtitle: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Desktop Banner Image *
              </label>

              <input
                required={!bannerForm.imageUrl}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => uploadImage(e, "imageUrl")}
                className="w-full border rounded-lg p-3 text-sm"
              />

              {bannerForm.imageUrl && (
                <div className="relative aspect-[16/7] rounded-lg overflow-hidden">
                  <Image
                    src={bannerForm.imageUrl}
                    alt="Desktop preview"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Mobile Banner Image (optional)
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => uploadImage(e, "mobileImageUrl")}
                className="w-full border rounded-lg p-3 text-sm"
              />

              {bannerForm.mobileImageUrl && (
                <div className="relative aspect-[4/3] max-w-xs rounded-lg overflow-hidden">
                  <Image
                    src={bannerForm.mobileImageUrl}
                    alt="Mobile preview"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            <input
              placeholder="Image alt text"
              value={bannerForm.altText}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, altText: e.target.value })
              }
              className="w-full border rounded-lg p-3"
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                placeholder="Button text (e.g. Shop Now)"
                value={bannerForm.buttonText}
                onChange={(e) =>
                  setBannerForm({ ...bannerForm, buttonText: e.target.value })
                }
                className="border rounded-lg p-3"
              />

              <input
                placeholder="Button link (e.g. /products)"
                value={bannerForm.buttonUrl}
                onChange={(e) =>
                  setBannerForm({ ...bannerForm, buttonUrl: e.target.value })
                }
                className="border rounded-lg p-3"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Placement</label>
                <select
                  value={bannerForm.placement}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      placement: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3 mt-1"
                >
                  <option value="HOME_HERO">Homepage Hero</option>
                  <option value="HOME_MIDDLE">Homepage Middle</option>
                  <option value="HOME_BOTTOM">Homepage Bottom</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold">Display order</label>
                <input
                  type="number"
                  value={bannerForm.sortOrder}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg p-3 mt-1"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Start date</label>
                <input
                  type="datetime-local"
                  value={bannerForm.startsAt}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      startsAt: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3 mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">End date</label>
                <input
                  type="datetime-local"
                  value={bannerForm.endsAt}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      endsAt: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3 mt-1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bannerForm.isActive}
                onChange={(e) =>
                  setBannerForm({
                    ...bannerForm,
                    isActive: e.target.checked,
                  })
                }
              />
              Activate banner
            </label>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                className="flex-1 border rounded-lg py-3 font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving || uploading}
                className="flex-1 bg-green-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
              >
                {uploading ? (
                  "Uploading image..."
                ) : saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Upload className="inline w-4 h-4 mr-2" />
                    {editingId ? "Save Changes" : "Create Banner"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

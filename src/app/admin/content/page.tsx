 "use client";

import { useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Eye,
  Upload,
  Loader2,
  X,
  Save,
  Globe,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import ContentEditor from "@/components/admin/ContentEditor";

type PageStatus = "DRAFT" | "PUBLISHED";

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: PageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: JSONContent;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface ContentForm {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  content: JSONContent;
  status: PageStatus;
}

const emptyContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const emptyForm: ContentForm = {
  title: "",
  slug: "",
  excerpt: "",
  coverImage: "",
  seoTitle: "",
  seoDescription: "",
  content: emptyContent,
  status: "DRAFT",
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export default function AdminContentPage() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [form, setForm] = useState<ContentForm>(emptyForm);

  async function fetchPages() {
    try {
      setLoading(true);

      const response = await fetch("/api/admin/content", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load pages.");
      }

      setPages(data.pages || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load pages."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPages();
  }, []);

  function updateField<K extends keyof ContentForm>(
    field: K,
    value: ContentForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openNewPage() {
    setEditingId(null);
    setForm({ ...emptyForm, content: emptyContent });
    setSlugManuallyEdited(false);
    setShowEditor(true);
  }

  function openEditPage(page: ContentPage) {
  setEditingId(page.id);

  setForm({
    title: page.title,
    slug: page.slug,
    excerpt: page.excerpt || "",
    coverImage: page.coverImage || "",
    seoTitle: page.seoTitle || "",
    seoDescription: page.seoDescription || "",
    content: page.content || emptyContent,
    status: page.status,
  });

  setSlugManuallyEdited(true);
  setShowEditor(true);
}

  async function uploadCoverImage(file?: File) {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover images must not exceed 5 MB.");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/content/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Image upload failed.");
      }

      updateField("coverImage", data.url);
      toast.success("Cover image uploaded.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function savePage(status: PageStatus) {
    if (form.title.trim().length < 2) {
      toast.error("Enter a title with at least 2 characters.");
      return;
    }

    if (!form.slug.trim()) {
      toast.error("Enter a valid page slug.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        status,
        content: form.content,
      };

      const response = await fetch("/api/admin/content", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingId
            ? { ...payload, pageId: editingId }
            : payload
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save page.");
      }

      toast.success(
        status === "PUBLISHED"
          ? "Page published successfully."
          : "Draft saved successfully."
      );

      setShowEditor(false);
      setEditingId(null);
      await fetchPages();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save page."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePage(pageId: string) {
    if (!window.confirm("Are you sure you want to delete this page?")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/content", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete page.");
      }

      toast.success("Page deleted.");
      await fetchPages();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete page."
      );
    }
  }

  const filteredPages = pages.filter((page) => {
    const query = search.toLowerCase();

    return (
      page.title.toLowerCase().includes(query) ||
      page.slug.toLowerCase().includes(query)
    );
  });

  const publishedCount = pages.filter(
    (page) => page.status === "PUBLISHED"
  ).length;

  const draftCount = pages.filter(
    (page) => page.status === "DRAFT"
  ).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileText size={16} />
            <span>Admin</span>
            <span>/</span>
            <span>Content Management</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Pages & Articles
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create, manage, and publish content across iBuyly.
          </p>
        </div>

        <button
          onClick={openNewPage}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          <Plus size={18} />
          Create Page
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Total Pages</p>
            <FileText className="text-slate-400" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {pages.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Published</p>
            <Globe className="text-green-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-green-600">
            {publishedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Drafts</p>
            <Pencil className="text-amber-500" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">
            {draftCount}
          </p>
        </div>
      </div>

      {/* Page List */}
      {!showEditor && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-900">
              All Content
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <button
                onClick={fetchPages}
                disabled={loading}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-slate-400" size={28} />
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <FileText
                size={40}
                className="mx-auto text-slate-300"
              />
              <h3 className="mt-4 font-semibold text-slate-800">
                No pages found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your first page to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPages.map((page) => (
                <div
                  key={page.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {page.coverImage ? (
                      <img
                        src={page.coverImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="text-slate-400" size={24} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900">
                      {page.title}
                    </h3>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      /{page.slug}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Updated{" "}
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        page.status === "PUBLISHED"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {page.status === "PUBLISHED"
                        ? "Published"
                        : "Draft"}
                    </span>

                    <button
                      onClick={() => openEditPage(page)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      title="Edit"
                    >
                      <Pencil size={17} />
                    </button>

                    {page.status === "PUBLISHED" && (
                      <a
                        href={`/pages/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        title="View page"
                      >
                        <Eye size={17} />
                      </a>
                    )}

                    <button
                      onClick={() => deletePage(page.id)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? "Edit Page" : "Create New Page"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add your content and publishing details.
              </p>
            </div>

            <button
              onClick={() => setShowEditor(false)}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Main Editor */}
            <div className="space-y-5 xl:col-span-2">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Page Title
                  </label>

                  <input
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;

                      updateField("title", title);

                      if (!slugManuallyEdited) {
                        updateField("slug", createSlug(title));
                      }
                    }}
                    placeholder="Enter page title"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    URL Slug
                  </label>

                  <div className="flex items-center rounded-xl border border-slate-200 px-3">
                    <span className="text-sm text-slate-400">
                      /pages/
                    </span>

                    <input
                      value={form.slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        updateField("slug", createSlug(e.target.value));
                      }}
                      placeholder="page-url"
                      className="w-full bg-transparent px-2 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Excerpt
                  </label>

                  <textarea
                    value={form.excerpt}
                    onChange={(e) =>
                      updateField("excerpt", e.target.value)
                    }
                    rows={3}
                    maxLength={500}
                    placeholder="A short introduction to this page..."
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-5">
                  <h3 className="font-semibold text-slate-900">
                    Page Content
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Write and format your page content.
                  </p>
                </div>

                <ContentEditor
                  key={editingId || "new-page"}
                  initialContent={form.content}
                  onChange={(content) =>
                    updateField("content", content)
                  }
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Cover Image */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">
                  Cover Image
                </h3>

                {form.coverImage ? (
                  <div className="relative mt-4 overflow-hidden rounded-xl">
                    <img
                      src={form.coverImage}
                      alt="Cover"
                      className="h-40 w-full object-cover"
                    />

                    <button
                      onClick={() => updateField("coverImage", "")}
                      className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-600 shadow"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center hover:bg-slate-50">
                    {uploading ? (
                      <Loader2
                        className="animate-spin text-slate-400"
                        size={28}
                      />
                    ) : (
                      <ImageIcon
                        className="text-slate-400"
                        size={28}
                      />
                    )}

                    <span className="mt-3 text-sm font-semibold text-slate-700">
                      {uploading ? "Uploading..." : "Upload cover image"}
                    </span>

                    <span className="mt-1 text-xs text-slate-400">
                      JPEG, PNG, WebP or GIF · Max 5 MB
                    </span>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        uploadCoverImage(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                )}

                <div className="mt-3">
                  <label className="mb-1 block text-xs text-slate-500">
                    Or enter image URL
                  </label>

                  <input
                    value={form.coverImage}
                    onChange={(e) =>
                      updateField("coverImage", e.target.value)
                    }
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* SEO */}
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    SEO Settings
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Improve how this page appears in search engines.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    SEO Title
                  </label>

                  <input
                    value={form.seoTitle}
                    onChange={(e) =>
                      updateField("seoTitle", e.target.value)
                    }
                    maxLength={200}
                    placeholder="Search engine title"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    SEO Description
                  </label>

                  <textarea
                    value={form.seoDescription}
                    onChange={(e) =>
                      updateField("seoDescription", e.target.value)
                    }
                    maxLength={500}
                    rows={4}
                    placeholder="Describe this page for search engines..."
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Publishing */}
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">
                  Publishing
                </h3>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateField(
                        "status",
                        e.target.value as PageStatus
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>

                <button
                  onClick={() => savePage("DRAFT")}
                  disabled={saving || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}
                  Save Draft
                </button>

                <button
                  onClick={() => savePage("PUBLISHED")}
                  disabled={saving || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Globe size={17} />
                  )}
                  Publish Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
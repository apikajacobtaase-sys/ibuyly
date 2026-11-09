"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
  Save,
  Send,
  Package,
  CheckCircle,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface ProductImage {
  url: string;
  altText: string;
  isPrimary: boolean;
}

interface VariantDraft {
  key: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
}

function createVariant(): VariantDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    sku: "",
    price: "",
    compareAtPrice: "",
    stockQuantity: "0",
    lowStockThreshold: "5",
  };
}

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewCatalogueProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([
    createVariant(),
  ]);

  const [uploadingImages, setUploadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        const response = await fetch("/api/admin/categories");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load categories");
        }

        if (mounted) {
          setCategories(data.categories || []);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load categories"
          );
        }
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  const activeCategories = categories.filter(
    (category) => category.isActive
  );

  const updateVariant = (
    key: string,
    field: keyof VariantDraft,
    value: string
  ) => {
    setVariants((previous) =>
      previous.map((variant) =>
        variant.key === key
          ? { ...variant, [field]: value }
          : variant
      )
    );
  };

  const addVariant = () => {
    if (variants.length >= 50) {
      setError("A product cannot have more than 50 variants.");
      return;
    }

    setVariants((previous) => [...previous, createVariant()]);
    setError("");
  };

  const removeVariant = (key: string) => {
    if (variants.length <= 1) {
      setError("A product must have at least one variant.");
      return;
    }

    setVariants((previous) =>
      previous.filter((variant) => variant.key !== key)
    );
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setError("");

    if (images.length + files.length > 10) {
      setError("You can upload a maximum of 10 product images.");
      event.target.value = "";
      return;
    }

    setUploadingImages(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.url) {
          throw new Error(
            data.error || `Failed to upload ${file.name}`
          );
        }

        setImages((previous) => [
          ...previous,
          {
            url: data.url,
            altText: title.trim() || file.name,
            isPrimary: previous.length === 0,
          },
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Image upload failed."
      );
    } finally {
      setUploadingImages(false);
      event.target.value = "";
    }
  };

  const setPrimaryImage = (index: number) => {
    setImages((previous) =>
      previous.map((image, imageIndex) => ({
        ...image,
        isPrimary: imageIndex === index,
      }))
    );
  };

  const removeImage = (index: number) => {
    setImages((previous) => {
      const remaining = previous.filter(
        (_, imageIndex) => imageIndex !== index
      );

      if (
        previous[index]?.isPrimary &&
        remaining.length > 0
      ) {
        remaining[0] = {
          ...remaining[0],
          isPrimary: true,
        };
      }

      return remaining;
    });
  };

  const updateImageAlt = (index: number, value: string) => {
    setImages((previous) =>
      previous.map((image, imageIndex) =>
        imageIndex === index
          ? { ...image, altText: value }
          : image
      )
    );
  };

  const handleSubmit = async (
    status: "DRAFT" | "ACTIVE"
  ) => {
    setError("");
    setSuccess("");

    if (uploadingImages) {
      setError("Please wait for image uploads to finish.");
      return;
    }

    if (title.trim().length < 2) {
      setError("Product title must contain at least 2 characters.");
      return;
    }

    if (!slug.trim()) {
      setError("Product slug is required.");
      return;
    }

    if (!categoryId) {
      setError("Please select a product category.");
      return;
    }

    if (description.trim().length < 1) {
      setError("Product description is required.");
      return;
    }

    if (variants.length < 1) {
      setError("Add at least one product variant.");
      return;
    }

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index];

      if (variant.sku.trim().length < 2) {
        setError(`Variant ${index + 1}: SKU must contain at least 2 characters.`);
        return;
      }

      if (
        !Number.isFinite(Number(variant.price)) ||
        Number(variant.price) <= 0
      ) {
        setError(`Variant ${index + 1}: Enter a valid price.`);
        return;
      }

      if (
        variant.compareAtPrice.trim() &&
        (
          !Number.isFinite(Number(variant.compareAtPrice)) ||
          Number(variant.compareAtPrice) <= 0
        )
      ) {
        setError(`Variant ${index + 1}: Enter a valid comparison price.`);
        return;
      }

      if (
        !/^\d+$/.test(variant.stockQuantity) ||
        !/^\d+$/.test(variant.lowStockThreshold)
      ) {
        setError(`Variant ${index + 1}: Stock values must be non-negative whole numbers.`);
        return;
      }
    }

    const primaryCount = images.filter(
      (image) => image.isPrimary
    ).length;

    if (primaryCount > 1) {
      setError("Only one image can be selected as primary.");
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      categoryId,
      status,
      variants: variants.map((variant) => ({
        sku: variant.sku.trim(),
        price: Number(variant.price),
        compareAtPrice: variant.compareAtPrice.trim()
          ? Number(variant.compareAtPrice)
          : null,
        stockQuantity: Number(variant.stockQuantity),
        lowStockThreshold: Number(variant.lowStockThreshold),
      })),
      images: images.map((image) => ({
        url: image.url,
        altText: image.altText.trim() || null,
        isPrimary: image.isPrimary,
      })),
    };

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const details = data.details
          ? Object.entries(data.details)
              .map(([field, messages]) =>
                `${field}: ${(messages as string[]).join(", ")}`
              )
              .join("; ")
          : "";

        throw new Error(
          details
            ? `${data.error}: ${details}`
            : data.error || "Failed to create catalogue product."
        );
      }

      setSuccess(
        status === "ACTIVE"
          ? "Catalogue product published successfully."
          : "Catalogue product saved as a draft."
      );

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const labelClass =
    "mb-1.5 block text-sm font-semibold text-gray-700";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/products"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Link>

          <h1 className="text-2xl font-bold text-gray-900">
            Create Catalogue Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Add a central product that sellers can list in the marketplace.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
          <Package className="h-4 w-4" />
          Central Catalogue
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Basic Information */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            Basic Information
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Describe the product and assign it to a category.
          </p>
        </div>

        <div className="space-y-4">

          <div>
            <label className={labelClass}>Product Title *</label>
            <input
              value={title}
              onChange={(event) => {
                const value = event.target.value;
                setTitle(value);

                if (!slugTouched) {
                  setSlug(generateSlug(value));
                }
              }}
              placeholder="e.g. Samsung Galaxy S25 Ultra"
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Product Slug *</label>
            <input
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(generateSlug(event.target.value));
              }}
              placeholder="samsung-galaxy-s25-ultra"
              maxLength={220}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Used in the product URL. Lowercase letters, numbers and hyphens only.
            </p>
          </div>

          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={loadingCategories}
              className={inputClass}
            >
              <option value="">
                {loadingCategories
                  ? "Loading categories..."
                  : "Select a category"}
              </option>

              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {!loadingCategories && activeCategories.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No active categories found. Create or activate a category first.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Product Description *</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the product, its features, specifications and benefits..."
              rows={6}
              maxLength={10000}
              className={inputClass}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {description.length}/10000
            </p>
          </div>

        </div>
      </section>

      {/* Product Images */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Product Images
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Upload up to 10 images. Choose one primary image.
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {images.length}/10
          </span>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
          {uploadingImages ? (
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-600" />
          ) : (
            <Upload className="mb-3 h-8 w-8 text-gray-400" />
          )}

          <span className="text-sm font-semibold text-gray-700">
            {uploadingImages ? "Uploading images..." : "Tap to upload product images"}
          </span>

          <span className="mt-1 text-xs text-gray-500">
            JPEG, PNG, WEBP or GIF. Maximum 5MB per image.
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={uploadingImages || images.length >= 10}
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>

        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image, index) => (
              <div
                key={`${image.url}-${index}`}
                className={`overflow-hidden rounded-xl border ${
                  image.isPrimary
                    ? "border-indigo-500 ring-2 ring-indigo-100"
                    : "border-gray-200"
                }`}
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={image.url}
                    alt={image.altText || "Product image"}
                    className="h-full w-full object-cover"
                  />

                  {image.isPrimary && (
                    <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white">
                      PRIMARY
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-red-600 shadow hover:bg-red-50"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 p-2">
                  <input
                    value={image.altText}
                    onChange={(event) =>
                      updateImageAlt(index, event.target.value)
                    }
                    placeholder="Image description"
                    className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                  />

                  {!image.isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(index)}
                      className="w-full rounded-md bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      Make Primary
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Variants */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Product Variants
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Define the catalogue SKUs and reference pricing.
            </p>
          </div>

          <button
            type="button"
            onClick={addVariant}
            disabled={variants.length >= 50}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Variant
          </button>
        </div>

        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.key}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                  Variant {index + 1}
                </h3>

                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className={labelClass}>SKU *</label>
                  <input
                    value={variant.sku}
                    onChange={(event) =>
                      updateVariant(variant.key, "sku", event.target.value)
                    }
                    placeholder="SAM-S25-256-BLK"
                    maxLength={100}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Reference Price (GH) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) =>
                      updateVariant(variant.key, "price", event.target.value)
                    }
                    placeholder="15000.00"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Compare-at Price (GH)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={variant.compareAtPrice}
                    onChange={(event) =>
                      updateVariant(
                        variant.key,
                        "compareAtPrice",
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Reference Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stockQuantity}
                    onChange={(event) =>
                      updateVariant(
                        variant.key,
                        "stockQuantity",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={variant.lowStockThreshold}
                    onChange={(event) =>
                      updateVariant(
                        variant.key,
                        "lowStockThreshold",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
          <strong>Catalogue pricing:</strong> These are reference values
          for the central catalogue. Sellers will establish their own
          selling prices and inventory when creating their offers.
        </div>
      </section>

      {/* Publishing Actions */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            Publish Product
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Save privately as a draft or make the product available in the catalogue.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/admin/products"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            type="button"
            disabled={submitting || uploadingImages || loadingCategories}
            onClick={() => handleSubmit("DRAFT")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save as Draft
          </button>

          <button
            type="button"
            disabled={
              submitting ||
              uploadingImages ||
              loadingCategories ||
              activeCategories.length === 0
            }
            onClick={() => handleSubmit("ACTIVE")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish Product
          </button>
        </div>
      </section>

    </div>
  );
}

 "use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Upload,
  ChevronUp,
  ChevronDown,
  Loader2,
  ImagePlus,
} from "lucide-react";

type ProductImage = {
  url: string;
  altText?: string;
  isPrimary?: boolean;
};

type Variant = {
  id?: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  attributes: string;
  isActive: boolean;
};

export default function EditCatalogueProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [productRes, categoryRes] = await Promise.all([
        fetch(`/api/admin/products/${id}`),
        fetch("/api/admin/categories"),
      ]);

      const productData = await productRes.json();
      const categoryData = await categoryRes.json();

      if (!productRes.ok) {
        throw new Error(productData.error || "Failed to load product.");
      }

      if (!categoryRes.ok) {
        throw new Error(categoryData.error || "Failed to load categories.");
      }

      const product = productData.product;

      setTitle(product.title);
      setDescription(product.description);
      setCategoryId(product.categoryId);
      setCategories(categoryData.categories || []);

      setImages(
        (product.images || []).map((image: any) => ({
          url: image.url,
          altText: image.altText || "",
          isPrimary: image.isPrimary,
        }))
      );

      setVariants(
        (product.variants || []).map((variant: any) => ({
          id: variant.id,
          sku: variant.sku,
          price: variant.price.toString(),
          compareAtPrice: variant.compareAtPrice?.toString() || "",
          stockQuantity: variant.stockQuantity.toString(),
          lowStockThreshold: variant.lowStockThreshold.toString(),
          attributes: JSON.stringify(variant.attributes || {}, null, 2),
          isActive: variant.isActive,
        }))
      );
    } catch (error: any) {
      alert(error.message || "Failed to load product.");
      router.push("/admin/products");
    } finally {
      setLoading(false);
    }
  };

  const updateVariant = (
    index: number,
    field: keyof Variant,
    value: string | boolean
  ) => {
    setVariants((current) =>
      current.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      )
    );
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      {
        sku: "",
        price: "0",
        compareAtPrice: "",
        stockQuantity: "0",
        lowStockThreshold: "5",
        attributes: "{}",
        isActive: true,
      },
    ]);
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Image upload failed.");
        }

        setImages((current) => [
          ...current,
          {
            url: data.url,
            altText: title,
            isPrimary: current.length === 0,
          },
        ]);
      }
    } catch (error: any) {
      alert(error.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (index: number, direction: number) => {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;

      if (target < 0 || target >= next.length) return current;

      [next[index], next[target]] = [next[target], next[index]];

      return next.map((image, i) => ({
        ...image,
        isPrimary: i === 0,
      }));
    });
  };

  const removeImage = (index: number) => {
    setImages((current) =>
      current
        .filter((_, i) => i !== index)
        .map((image, i) => ({
          ...image,
          isPrimary: i === 0,
        }))
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !categoryId) {
      alert("Please complete the product information.");
      return;
    }

    if (!variants.length) {
      alert("A product must have at least one variant.");
      return;
    }

    let formattedVariants;

    try {
      formattedVariants = variants.map((variant) => ({
        ...variant,
        attributes: JSON.parse(variant.attributes || "{}"),
      }));
    } catch {
      alert("One or more variant attributes contain invalid JSON.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId,
          images,
          variants: formattedVariants,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update product.");
      }

      alert("Catalogue product updated successfully.");
      router.push(`/admin/products/${id}`);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={`/admin/products/${id}`}
            className="inline-flex items-center gap-2 text-sm text-indigo-600 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Product
          </Link>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Edit Catalogue Product
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage central catalogue information and inventory.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Product Information */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">
            Product Information
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Edit the basic information displayed in the catalogue.
          </p>
        </div>

        <div>
          <label className={labelClass}>Product Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Product name"
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Describe this product..."
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.isActive ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Product Images */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Product Images</h2>
            <p className="text-xs text-gray-500 mt-1">
              The first image will be the primary product image.
            </p>
          </div>

          <label className="cursor-pointer flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-medium">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Add Images
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                uploadImages(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <ImagePlus className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              No product images added.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((image, index) => (
              <div
                key={`${image.url}-${index}`}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="aspect-square bg-gray-50">
                  <img
                    src={image.url}
                    alt={image.altText || title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="p-2 space-y-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-600">
                      Image Alt Text
                    </span>
                    <input
                      type="text"
                      value={image.altText || ""}
                      maxLength={300}
                      placeholder={title || "Describe this image"}
                      onChange={(e) =>
                        setImages((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, altText: e.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  {index === 0 && (
                    <span className="text-xs font-semibold text-indigo-600">
                      Primary Image
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveImage(index, -1)}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                      title="Move left"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={index === images.length - 1}
                      onClick={() => moveImage(index, 1)}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                      title="Move right"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400">
          JPEG, PNG, WebP or GIF. Maximum 5 MB per image.
        </p>
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">
              Variants, Pricing & Inventory
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              These are central catalogue values, separate from seller offers.
            </p>
          </div>

          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="w-4 h-4" />
            Add Variant
          </button>
        </div>

        {variants.map((variant, index) => (
          <div
            key={variant.id || `new-${index}`}
            className="border border-gray-200 rounded-xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-800">
                Variant {index + 1}
              </h3>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={variant.isActive}
                  onChange={(e) =>
                    updateVariant(index, "isActive", e.target.checked)
                  }
                  className="rounded text-indigo-600"
                />
                Active
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>SKU</label>
                <input
                  value={variant.sku}
                  onChange={(e) =>
                    updateVariant(index, "sku", e.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. PHONE-128GB"
                />
              </div>

              <div>
                <label className={labelClass}>Price (GH₵)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.price}
                  onChange={(e) =>
                    updateVariant(index, "price", e.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Compare-at Price (GH₵)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.compareAtPrice}
                  onChange={(e) =>
                    updateVariant(index, "compareAtPrice", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className={labelClass}>Catalogue Stock</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={variant.stockQuantity}
                  onChange={(e) =>
                    updateVariant(index, "stockQuantity", e.target.value)
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
                  onChange={(e) =>
                    updateVariant(index, "lowStockThreshold", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Variant Attributes (JSON)</label>
              <textarea
                rows={3}
                value={variant.attributes}
                onChange={(e) =>
                  updateVariant(index, "attributes", e.target.value)
                }
                className={`${inputClass} font-mono text-xs`}
                placeholder='{"color":"Black","storage":"128GB"}'
              />
            </div>

            {variant.id && (
              <p className="text-xs text-gray-400">
                Existing variant — its seller offers will remain unchanged.
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Bottom Save */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
        <Link
          href={`/admin/products/${id}`}
          className="px-5 py-3 text-center rounded-lg border border-gray-200 text-sm font-semibold text-gray-700"
        >
          Cancel
        </Link>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Catalogue Changes"}
        </button>
      </div>
    </div>
  );
}

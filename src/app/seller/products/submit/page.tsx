 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  X,
  Sparkles,
  ImagePlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface UploadedImage {
  url: string;
  altText: string;
}
interface AIAnalysis {
  score: number;
  optimizedTitle: string;
  optimizedDescription: string;
  attributes: Record<string, unknown>;
  semanticTags: string[];
  suggestions: string[];
}

const inputClass =
  "min-h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function SubmitProductPage() {
  const router = useRouter();
const [analyzing, setAnalyzing] = useState(false);
const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [sellerSku, setSellerSku] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load categories.");
        }

        setCategories(data.categories || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load categories."
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    if (images.length + files.length > 10) {
      setError("You can upload a maximum of 10 product images.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const uploaded: UploadedImage[] = [];

      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
          throw new Error(`${file.name}: Use JPEG, PNG, WebP or GIF.`);
        }

        if (file.size > 5 * 1024 * 1024 || file.size === 0) {
          throw new Error(`${file.name}: Image must not exceed 5 MB.`);
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "/api/seller/product-submissions/upload",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}.`);
        }

        uploaded.push({
          url: data.url,
          altText: title.trim() || "Product image",
        });
      }

      setImages((current) => [...current, ...uploaded]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Image upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, i) => i !== index));
  };
const handleAnalyzeListing = async () => {
  setError("");
  setAiAnalysis(null);

  if (title.trim().length < 2 || description.trim().length < 10) {
    setError("Enter a product name and description before using AI analysis.");
    return;
  }

  setAnalyzing(true);

  try {
    const selectedCategory = categories.find(
      (category) => category.id === categoryId
    );

    const response = await fetch("/api/seller/ai/analyze-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        imageCount: images.length,
        category: selectedCategory?.name || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI analysis failed.");
    }

    setAiAnalysis(data);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to analyse listing."
    );
  } finally {
    setAnalyzing(false);
  }
};
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (images.length === 0) {
      setError("Upload at least one product image.");
      return;
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stockQuantity);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a valid selling price greater than zero.");
      return;
    }

    if (
      !Number.isInteger(parsedStock) ||
      parsedStock < 0 ||
      parsedStock > 100000
    ) {
      setError("Enter a valid whole-number stock quantity.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/seller/product-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  title: title.trim(),
  description: description.trim(),
  categoryId,
  price: parsedPrice,
  stockQuantity: parsedStock,
  sellerSku: sellerSku.trim(),
  images,
  ...(aiAnalysis && {
    aiQualityScore: aiAnalysis.score,
    aiSuggestions: aiAnalysis.suggestions,
    attributes: aiAnalysis.attributes,
    semanticTags: [
  ...new Set(
    aiAnalysis.semanticTags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.toLowerCase())
  ),
],
  }),
}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit product.");
      }

      setSuccess("Product submitted successfully. Awaiting administrator review.");

      setTimeout(() => {
        router.push("/seller/products");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/seller/products"
          className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Submit a New Product
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Can't find a product in the iBUY catalogue? Submit it for
            administrator approval.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Product name *
            </label>
            <input
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => {
  setTitle(e.target.value);
  setAiAnalysis(null);
}}
              placeholder="Enter product name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description *
            </label>
            <textarea
              required
              minLength={10}
              maxLength={10000}
              rows={5}
              value={description}
              onChange={(e) => {
  setDescription(e.target.value);
  setAiAnalysis(null);
}}
              placeholder="Describe the product, its features and specifications..."
              className="w-full rounded-xl border border-gray-300 p-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <Sparkles className="h-5 w-5 text-teal-600" />
        iBUY AI Listing Assistant
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Improve your product listing and make it easier for buyers to discover.
      </p>
    </div>

    <button
      type="button"
      onClick={handleAnalyzeListing}
      disabled={analyzing || submitting}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
    >
      {analyzing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {analyzing ? "Analysing..." : "Analyse Listing"}
    </button>
  </div>

  {aiAnalysis && (
    <div className="mt-4 space-y-4 border-t border-teal-200 pt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          Listing quality score
        </span>
        <span className={`text-xl font-bold ${
  aiAnalysis.score >= 80
    ? "text-green-700"
    : aiAnalysis.score >= 50
      ? "text-amber-600"
      : "text-red-600"
}`}>
          {aiAnalysis.score}/100 — {
  aiAnalysis.score >= 80
    ? "Excellent"
    : aiAnalysis.score >= 50
      ? "Good"
      : "Needs improvement"
}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-teal-600"
          style={{ width: `${aiAnalysis.score}%` }}
        />
        <button
  type="button"
  onClick={() => {
    setTitle(aiAnalysis.optimizedTitle);
    setDescription(aiAnalysis.optimizedDescription);
  }}
  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700"
>
  Apply All Improvements
</button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-800">
          AI improvements
        </p>

        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold text-gray-500">TITLE</p>
          <p className="mt-1 text-sm text-gray-800">
            {aiAnalysis.optimizedTitle}
          </p>
          <button
            type="button"
            onClick={() => setTitle(aiAnalysis.optimizedTitle)}
            className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
          >
            Apply title
          </button>
        </div>

        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold text-gray-500">DESCRIPTION</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
            {aiAnalysis.optimizedDescription}
          </p>
          <button
            type="button"
            onClick={() => setDescription(aiAnalysis.optimizedDescription)}
            className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
          >
            Apply description
          </button>
        </div>

        {Object.keys(aiAnalysis.attributes).length > 0 && (
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs font-semibold text-gray-500">
              EXTRACTED PRODUCT ATTRIBUTES
            </p>
            <div className="mt-2 space-y-1">
            {Object.entries(aiAnalysis.attributes).map(([key, value]) => (
  <div key={key} className="space-y-1">
    <label className="text-xs font-medium capitalize text-gray-600">
      {key}
    </label>
    <input
      type="text"
      value={typeof value === "string" ? value : JSON.stringify(value)}
      onChange={(e) =>
        setAiAnalysis((prev) =>
          prev
            ? {
                ...prev,
                attributes: {
                  ...prev.attributes,
                  [key]: e.target.value,
                },
              }
            : null
        )
      }
      className={inputClass}
    />
  </div>
))}
            </div>
          </div>
        )}

        <div>
  <p className="mb-2 text-xs font-semibold text-gray-500">
    SEARCH TAGS
  </p>

  <div className="space-y-2">
    {aiAnalysis.semanticTags.map((tag, index) => (
      <div key={`${tag}-${index}`} className="flex items-center gap-2">
        <input
          type="text"
          value={tag}
          onChange={(e) =>
            setAiAnalysis((prev) =>
              prev
                ? {
                    ...prev,
                    semanticTags: prev.semanticTags.map((item, i) =>
                      i === index ? e.target.value : item
                    ),
                  }
                : null
            )
          }
          className={inputClass}
        />
     <button
  type="button"
 onClick={() =>
  setAiAnalysis((prev) =>
    prev && prev.semanticTags.length < 20
      ? {
          ...prev,
          semanticTags: [...prev.semanticTags, ""],
        }
      : prev
  )

}
disabled={aiAnalysis.semanticTags.length >= 20}

  className="text-sm font-semibold text-teal-700 hover:underline"
>
  + Add search tag
</button>
        <button
          type="button"
          onClick={() =>
            setAiAnalysis((prev) =>
              prev
                ? {
                    ...prev,
                    semanticTags: prev.semanticTags.filter(
                      (_, i) => i !== index
                    ),
                  }
                : null
            )
          }
          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    ))}
  </div>
</div>

        {aiAnalysis.suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">
              SUGGESTIONS
            </p>
           <div className="space-y-2">
  {aiAnalysis.suggestions.map((suggestion, index) => (
    <div
      key={index}
      className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 p-3"
    >
      <p className="text-sm text-gray-700">{suggestion}</p>

      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(suggestion)}
        className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
      >
        Copy
      </button>
    </div>
  ))}
</div>
          </div>
        )}
      </div>
    </div>
  )}
</div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Category *
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loadingCategories}
              className={`${inputClass} bg-white`}
            >
              <option value="">
                {loadingCategories ? "Loading categories..." : "Select category"}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Selling price (GH₵) *
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 250.00"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Available stock *
              </label>
              <input
                required
                type="number"
                min="0"
                max="100000"
                step="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="e.g. 20"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Your SKU (optional)
            </label>
            <input
              maxLength={100}
              value={sellerSku}
              onChange={(e) => setSellerSku(e.target.value)}
              placeholder="Your internal product code"
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Product images *
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Upload 1–10 images. JPEG, PNG, WebP or GIF. Maximum 5 MB each.
              </p>
            </div>

            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center transition hover:border-teal-400 hover:bg-teal-50/30">
              {uploading ? (
                <Loader2 className="mb-2 h-7 w-7 animate-spin text-teal-600" />
              ) : (
                <ImagePlus className="mb-2 h-7 w-7 text-gray-400" />
              )}

              <span className="text-sm font-semibold text-gray-700">
                {uploading ? "Uploading images..." : "Choose product images"}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                {images.length}/10 images uploaded
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={uploading || images.length >= 10}
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image, index) => (
                  <div
                    key={`${image.url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-gray-200"
                  >
                    <img
                      src={image.url}
                      alt={`Product image ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    {index === 0 && (
                      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                        Main image
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={uploading || submitting}
                      className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-red-600 shadow hover:bg-red-50 disabled:opacity-50"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              What happens next?
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Your product will be reviewed by the iBUY administration team.
              It will only become available in the public catalogue after
              approval.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || uploading || loadingCategories || categories.length === 0}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting product...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Submit for Approval
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  Search,
  Copy,
  Package,
} from "lucide-react";

interface Variant {
  id: string;
  sku: string | null;
  price: number;
  attributes: unknown;
}

interface CatalogueProduct {
  id: string;
  title: string;
  slug: string;
  category: { name: string };
  variants: Variant[];
}

interface ImportResult {
  created: number;
  errors: number;
  details: {
    created: { variantId: string; offerId: string }[];
    errors: string[];
  };
}

export default function BulkImportPage() {
  const router = useRouter();
  const { status } = useSession();

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/seller/import");
    }
  }, [status, router]);

  const searchCatalogue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!query.trim()) {
      alert("Enter a product name to search.");
      return;
    }

    setSearching(true);
    setSearched(false);
    setProducts([]);

    try {
      const res = await fetch(
        `/api/seller/catalogue-search?q=${encodeURIComponent(query.trim())}&limit=20`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Catalogue search failed.");
      }

      setProducts(data.products || []);
      setSearched(true);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Catalogue search failed."
      );
    } finally {
      setSearching(false);
    }
  };

  const copyVariantId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      alert("Variant ID copied.");
    } catch {
      alert(`Copy this variant ID manually: ${id}`);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      "variantId,price,stock,sku,condition",
      "PASTE_VARIANT_ID_HERE,100.00,50,SELLER-SKU-001,NEW",
      "PASTE_ANOTHER_VARIANT_ID,250.50,20,SELLER-SKU-002,NEW",
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ibuy-seller-offers-template.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    setFile(selectedFile);
    setResult(null);
    setUploadError("");
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a CSV file.");
      return;
    }

    setUploading(true);
    setResult(null);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/seller/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Import failed.");
        return;
      }

      setResult(data);
      setFile(null);

      const input = document.getElementById(
        "seller-import-file"
      ) as HTMLInputElement | null;

      if (input) input.value = "";
    } catch {
      setUploadError("Unable to complete the import. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bulk Import Offers
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Add multiple seller offers to existing iBUY catalogue products.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900 text-sm">
          Important: Existing catalogue products only
        </h2>
        <p className="text-sm text-blue-800 mt-1">
          This importer does not create new catalogue products. Search for
          existing products, copy their variant IDs, and use those IDs in
          your CSV. Your prices and stock remain specific to your store.
        </p>
      </div>

      {/* Catalogue search */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Search className="w-5 h-5" />
            1. Find Catalogue Variants
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Search for the product you want to sell.
          </p>
        </div>

        <form onSubmit={searchCatalogue} className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product name..."
            maxLength={100}
            className="min-w-0 flex-1 px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </form>

        {searched && products.length === 0 && (
          <p className="text-sm text-gray-500">
            No matching catalogue products found.
          </p>
        )}

        {products.length > 0 && (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="border border-gray-200 rounded-lg p-3 space-y-3"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {product.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {product.category.name}
                  </p>
                </div>

                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="bg-gray-50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-800">
                        Catalogue price: GH{variant.price.toFixed(2)}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {variant.sku || "No catalogue SKU"}
                      </span>
                    </div>

                    {variant.attributes != null && (
                      <p className="text-xs text-gray-600 break-words">
                        {typeof variant.attributes === "string"
                          ? variant.attributes
                          : JSON.stringify(variant.attributes)}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 text-xs text-gray-600 break-all">
                        {variant.id}
                      </code>

                      <button
                        type="button"
                        onClick={() => copyVariantId(variant.id)}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium"
                      >
                        <Copy className="w-3 h-3" />
                        Copy ID
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CSV template */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Download className="w-5 h-5" />
          2. Download CSV Template
        </h2>

        <p className="text-sm text-gray-600">
          Each row represents one seller offer. Use the copied variant ID
          and provide your own selling price and available stock.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {["Column", "Description"].map((heading) => (
                  <th key={heading} className="p-2 border">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["variantId", "Existing catalogue variant ID"],
                ["price", "Your selling price (positive number)"],
                ["stock", "Your available quantity (whole number)"],
                ["sku", "Your optional seller SKU"],
                ["condition", "NEW, USED, or another condition"],
              ].map(([column, description]) => (
                <tr key={column}>
                  <td className="p-2 border font-medium">{column}</td>
                  <td className="p-2 border text-gray-600">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </section>

      {/* Upload */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          3. Upload Your Offers
        </h2>

        <label className="flex flex-col items-center justify-center w-full min-h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors p-5">
          <FileText className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 text-center">
            <span className="font-semibold text-indigo-600">
              Click to upload
            </span>{" "}
            a CSV file
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Maximum 100 offers  1 MB
          </p>
          <input
            id="seller-import-file"
            type="file"
            className="hidden"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
        </label>

        {file && (
          <p className="text-sm text-gray-700 break-all">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        )}

        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {uploadError}
          </div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Importing Offers...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import Offers
            </>
          )}
        </button>
      </section>

      {/* Results */}
      {result && (
        <section className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-900">
              Successfully created {result.created} seller offer(s).
            </p>
          </div>

          {result.errors > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {result.errors} row(s) could not be imported:
                </p>
                <ul className="mt-2 text-xs text-gray-600 list-disc list-inside max-h-40 overflow-y-auto space-y-1">
                  {result.details.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/seller/products")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100"
          >
            <Package className="w-4 h-4" />
            Go to My Products
          </button>
        </section>
      )}
    </div>
  );
}
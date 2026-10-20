// src/app/seller/products/import/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Download } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

export default function BulkImportPage() {
  const router = useRouter();
  const { status } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number; details: any } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/seller/products/import");
    if (status === "authenticated") fetchCategories();
  }, [status, router]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories"); // Assuming you have a public categories API
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedCategory) {
      alert("Please select a file and a category.");
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("categoryId", selectedCategory);

    try {
      const res = await fetch("/api/seller/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "title,description,price,stock,sku\n" +
      "\"Example Product 1\",\"This is a great product.\",100.00,50,SKU-001\n" +
      "\"Example Product 2\",\"Another awesome item.\",250.50,20,SKU-002";
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ibuy_product_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading") {
    return <div className="flex justify-center items-center min-h-[400px]"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-7 h-7" />
          Bulk Product Import
        </h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV file to create multiple products at once.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Step 1: Download Template */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">1. Download Template</h3>
          <p className="text-sm text-gray-600 mb-3">Start by downloading our CSV template to see the required format.</p>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>
        </div>

        {/* Step 2: Select Category */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">2. Select Category</h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Choose a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Step 3: Upload File */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">3. Upload Your CSV</h3>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV files only (Max 100 products)</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
            </label>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-700">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file || !selectedCategory}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Importing Products...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import Products
            </>
          )}
        </button>

        {/* Results */}
        {result && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-gray-900">
                Successfully imported {result.created} product(s) as Drafts.
              </p>
            </div>
            {result.errors > 0 && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{result.errors} row(s) had errors:</p>
                  <ul className="mt-1 text-xs text-gray-600 list-disc list-inside max-h-32 overflow-y-auto">
                    {result.details.errors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <button
              onClick={() => router.push("/seller/products")}
              className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go to My Products →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
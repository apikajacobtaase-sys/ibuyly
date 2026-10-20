// src/app/seller/products/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Attribute {
  key: string;
  value: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI Analyzer State
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    price: "",
    compareAtPrice: "",
    costPrice: "",
    sku: "",
    stock: "",
  });

  const [imageFiles, setImageFiles] = useState<Array<{ file: File | null; url: string }>>([
    { file: null, url: "" }
  ]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const [attributes, setAttributes] = useState<Attribute[]>([{ key: "", value: "" }]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const analyzeListing = async () => {
    if (!formData.title || !formData.description) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/seller/ai/analyze-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          imageCount: imageFiles.filter(img => img.url && !img.url.startsWith("blob:")).length,
          attributes: attributes.reduce((acc, curr) => {
            if (curr.key && curr.value) acc[curr.key] = curr.value;
            return acc;
          }, {} as Record<string, string>),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAiScore(data.score);
        setAiSuggestions(data.suggestions);
      } else {
        console.error("AI Analysis failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to analyze listing", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (res.ok) {
        const allCategories: Category[] = [];
        for (const cat of data.categories || []) {
          allCategories.push({ id: cat.id, name: cat.name });
          for (const child of cat.children || []) {
            allCategories.push({ id: child.id, name: `${cat.name} → ${child.name}` });
          }
        }
        setCategories(allCategories);
      }
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const handleAddImage = () => {
    setImageFiles([...imageFiles, { file: null, url: "" }]);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const handleFileChange = async (index: number, file: File | null) => {
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    const newFiles = [...imageFiles];
    newFiles[index] = { file, url: localUrl };
    setImageFiles(newFiles);

    setUploadingIndex(index);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();
      if (res.ok) {
        newFiles[index] = { file, url: data.url };
        setImageFiles([...newFiles]);
      } else {
        alert(`❌ Upload failed: ${data.error}`);
        newFiles[index] = { file: null, url: "" };
        setImageFiles([...newFiles]);
      }
    } catch (error) {
      alert("❌ Network error during upload");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: "", value: "" }]);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index: number, field: "key" | "value", value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const handleSubmit = async (e: React.FormEvent, submitAs: "DRAFT" | "ACTIVE") => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const attributesObj: Record<string, string> = {};
      for (const attr of attributes) {
        if (attr.key.trim() && attr.value.trim()) {
          attributesObj[attr.key.trim()] = attr.value.trim();
        }
      }

      const validImageUrls = imageFiles
        .filter((img) => img.url && !img.url.startsWith("blob:"))
        .map((img) => img.url);

      if (validImageUrls.length === 0) {
        alert("⚠️ Please wait for at least one image to finish uploading.");
        setIsSubmitting(false);
        return;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        categoryId: formData.categoryId,
        price: formData.price,
        compareAtPrice: formData.compareAtPrice || null,
        costPrice: formData.costPrice || null,
        sku: formData.sku,
        stock: formData.stock,
        status: submitAs,
        imageUrls: validImageUrls,
        attributes: attributesObj,
      };

      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Product ${submitAs === "DRAFT" ? "saved as draft" : "published"} successfully!`);
        router.push("/seller/products");
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <Link href="/seller/products" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Create New Product</h2>
        <p className="text-sm text-gray-500 mt-1">Fill in the details below. You can save as draft or publish immediately.</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Title <span className="text-red-500">*</span></label>
              <input
                type="text" required value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Premium Wireless Headphones"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
              <textarea
                required rows={4} value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your product in detail..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              
              {!showNewCategoryInput ? (
                <select
                  required 
                  value={formData.categoryId}
                  onChange={(e) => {
                    if (e.target.value === "NEW") {
                      setShowNewCategoryInput(true);
                      setFormData({ ...formData, categoryId: "" });
                    } else {
                      setFormData({ ...formData, categoryId: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  <option value="NEW" className="font-semibold text-teal-700">
                    ➕ Create New Category...
                  </option>
                </select>
              ) : (
                <div className="space-y-3 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-teal-800 mb-1">
                      New Category Name
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g., Smart Home Devices"
                      className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setShowNewCategoryInput(false);
                          setNewCategoryName("");
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isCreatingCategory || !newCategoryName.trim()}
                      onClick={async () => {
                        setIsCreatingCategory(true);
                        try {
                          const res = await fetch("/api/seller/categories", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newCategoryName.trim() }),
                          });
                          const data = await res.json();
                          
                          if (res.ok) {
                            const newCat = { id: data.category.id, name: data.category.name };
                            setCategories([...categories, newCat]);
                            setFormData({ ...formData, categoryId: newCat.id });
                            setShowNewCategoryInput(false);
                            setNewCategoryName("");
                          } else {
                            alert(`❌ Error: ${data.error}`);
                          }
                        } catch (error) {
                          alert("❌ Network error. Failed to create category.");
                        } finally {
                          setIsCreatingCategory(false);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {isCreatingCategory ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Creating...
                        </>
                      ) : (
                        "Create & Select"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Quality Score Card */}
            {(formData.title.length > 5 || formData.description.length > 10) && (
              <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                    ✨ AI Listing Quality
                  </h4>
                  <button
                    type="button"
                    onClick={analyzeListing}
                    disabled={isAnalyzing}
                    className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Now"}
                  </button>
                </div>
                
                {aiScore !== null && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    {/* Score Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-medium text-indigo-800 mb-1">
                        <span>Quality Score</span>
                        <span>{aiScore}/100</span>
                      </div>
                      <div className="w-full bg-indigo-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            aiScore >= 80 ? "bg-green-500" : aiScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${aiScore}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {aiSuggestions.length > 0 && (
                      <ul className="space-y-1">
                        {aiSuggestions.map((suggestion, idx) => (
                          <li key={idx} className="text-xs text-indigo-800 flex items-start gap-2">
                            <span className="text-indigo-500 mt-0.5">💡</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pricing & Inventory */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Pricing & Inventory</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (GH₵) <span className="text-red-500">*</span></label>
              <input type="number" required step="0.01" min="0" value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Compare-at Price (GH₵)</label>
              <input type="number" step="0.01" min="0" value={formData.compareAtPrice}
                onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                placeholder="Original price" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost Price (GH₵)</label>
              <input type="number" step="0.01" min="0" value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="Your cost (private)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g., HEADPHONE-001" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Quantity <span className="text-red-500">*</span></label>
              <input type="number" required min="0" value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Product Images */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Product Images</h3>
              <p className="text-xs text-gray-500 mt-0.5">First image will be the primary thumbnail</p>
            </div>
            <button type="button" onClick={handleAddImage} className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Another
            </button>
          </div>
          <div className="space-y-4">
            {imageFiles.map((fileObj, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="file" accept="image/*"
                    onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="w-24 flex-shrink-0">
                  {uploadingIndex === idx ? (
                    <div className="flex items-center justify-center h-10 text-xs text-teal-600 font-medium">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600 mr-2"></div>
                      Uploading...
                    </div>
                  ) : fileObj.url ? (
                    <div className="relative h-10 w-10 rounded-md overflow-hidden border border-gray-200">
                      <img src={fileObj.url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                </div>
                {imageFiles.length > 1 && (
                  <button type="button" onClick={() => handleRemoveImage(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Attributes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Specifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">Add custom attributes (e.g., brand, color, material)</p>
            </div>
            <button type="button" onClick={handleAddAttribute} className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Attribute
            </button>
          </div>
          <div className="space-y-2">
            {attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text" value={attr.key}
                  onChange={(e) => handleAttributeChange(idx, "key", e.target.value)}
                  placeholder="Key (e.g., Brand)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text" value={attr.value}
                  onChange={(e) => handleAttributeChange(idx, "value", e.target.value)}
                  placeholder="Value (e.g., Sony)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {attributes.length > 1 && (
                  <button type="button" onClick={() => handleRemoveAttribute(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Link href="/seller/products" className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition text-center">
            Cancel
          </Link>
          <button
            type="button" onClick={(e) => handleSubmit(e, "DRAFT")} disabled={isSubmitting}
            className="px-6 py-2.5 bg-gray-100 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button" onClick={(e) => handleSubmit(e, "ACTIVE")} disabled={isSubmitting}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            {isSubmitting ? "Publishing..." : "Publish Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
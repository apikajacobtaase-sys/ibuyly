 // src/app/products/[slug]/page.tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Heart, Star, Truck, ShieldCheck } from "lucide-react";
import ReviewSection from "@/components/product/ReviewSection";
import AddToCartButton from "@/components/product/AddToCartButton"; // We'll create this next

// ✅ 1. Generate Metadata for SEO & Social Sharing
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await db.product.findUnique({
    where: { slug: params.slug },
    include: { variants: { include: { sellerOffers: { take: 1 } } } }
  });

  if (!product) return { title: "Product Not Found" };

  const offer = product.variants[0]?.sellerOffers[0];
  const price = offer ? parseFloat(offer.price.toString()) : 0;

  return {
    title: `${product.title} | iBUY Ghana`,
    description: product.description?.slice(0, 160) || `Buy ${product.title} at the best price in Ghana.`,
    openGraph: {
      images: [product.images[0]?.url || "/og-image.png"],
      type: "product",
      price: {
        amount: price.toString(),
        currency: "GHS",
      },
    },
  };
}

// ✅ 2. Server Component for Data Fetching
export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await db.product.findUnique({
    where: { slug: params.slug },
    include: {
      images: true,
      category: true,
      variants: {
        include: {
          sellerOffers: {
            include: {
              seller: { select: { businessName: true, id: true } }
            }
          }
        }
      }
    }
  });

  if (!product) notFound();

  // Get the best offer for the default view
  const bestOffer = product.variants[0]?.sellerOffers[0];
  const price = bestOffer ? parseFloat(bestOffer.price.toString()) : 0;
  const stock = bestOffer?.stockQuantity || 0;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-white min-h-screen">
      
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-green-600">Home</Link> / 
        <Link href="/categories" className="hover:text-green-600 ml-1">Categories</Link> / 
        <span className="text-gray-900 ml-1">{product.category?.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">
            {product.images[0] ? (
              <Image 
                src={product.images[0].url} 
                alt={product.title} 
                fill 
                className="object-cover hover:scale-105 transition-transform duration-500"
                priority // ✅ Loads this image first for LCP score
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>
          {/* Thumbnail Grid could go here */}
        </div>

        {/* Right: Product Details */}
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{product.title}</h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex text-yellow-400">
              <Star className="w-5 h-5 fill-current" />
              <span className="ml-1 text-gray-900 font-semibold">4.8</span>
            </div>
            <span className="text-gray-400">|</span>
            <span className="text-green-600 font-medium">{stock > 0 ? "In Stock" : "Out of Stock"}</span>
          </div>

          <div className="text-4xl font-bold text-green-600 mb-6">
            GH₵ {price.toFixed(2)}
          </div>

          <p className="text-gray-600 leading-relaxed mb-8">
            {product.description || "No description available."}
          </p>

          {/* Trust Badges */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Fast Delivery</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Secure Payment</span>
            </div>
          </div>

          {/* Client Component for Interactive Buttons */}
          <AddToCartButton 
            product={product}
            bestOfferId={bestOffer?.id}
            bestVariantId={product.variants[0]?.id}
            price={price}
            stock={stock}
          />

        </div>
      </div>

      {/* Reviews Section */}
      <ReviewSection productSlug={product.slug} />
    </div>
  );
}
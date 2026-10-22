 // src/app/products/[slug]/page.tsx
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Star, Truck, ShieldCheck, MessageCircle, Check } from "lucide-react";
import ReviewSection from "@/components/product/ReviewSection";
import AddToCartButton from "@/components/product/AddToCartButton";
import ChatBox from "@/components/chat/ChatBox";
import StartChatButton from "@/components/chat/StartChatButton";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  if (!slug) notFound();

  const session = await getServerSession(authOptions);
  
  const product = await db.product.findUnique({
    where: { slug: slug },
    include: {
      images: true,
      category: true,
      variants: {
        include: {
          sellerOffers: {
            include: {
              seller: { select: { businessName: true, id: true, userId: true } }
            }
          }
        }
      }
    }
  });

  if (!product) notFound();

  const bestOffer = product.variants[0]?.sellerOffers[0];
  const seller = bestOffer?.seller;
  
  const price = bestOffer ? Number(bestOffer.price) : 0;
  const stock = bestOffer?.stockQuantity || 0;

  let conversationId = null;
  let initialMessages = [];
  
  if (session && seller) {
    const conv = await db.conversation.findFirst({
      where: {
        buyerId: session.user.id,
        sellerId: seller.userId,
        productId: product.id
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { firstName: true, lastName: true } } }
        }
      }
    });

    if (conv) {
      conversationId = conv.id;
      initialMessages = conv.messages;
    }
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Breadcrumbs */}
        <nav className="flex text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link href="/" className="hover:text-green-600 transition-colors">Home</Link> 
          <span className="mx-2 text-gray-300">/</span>
          <Link href="/categories" className="hover:text-green-600 transition-colors">Categories</Link> 
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-gray-900 font-medium">{product.category?.name}</span>
        </nav>

        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          
          {/* LEFT COLUMN: Images (Span 7) */}
          <div className="lg:col-span-7 mb-10 lg:mb-0">
            <div className="aspect-[4/3] md:aspect-square bg-gray-50 rounded-2xl overflow-hidden relative border border-gray-100 shadow-sm group">
              {product.images[0] ? (
                <Image 
                  src={product.images[0].url} 
                  alt={product.title} 
                  fill 
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out"
                  priority 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 60vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">No Image</div>
              )}
            </div>
            
            {/* Thumbnail Grid (Optional: Map through product.images if you have more than 1) */}
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {product.images.slice(0, 4).map((img, idx) => (
                  <div key={idx} className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-green-500 transition-colors">
                    <Image src={img.url} alt="" width={100} height={100} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Details (Span 5) */}
          <div className="lg:col-span-5 flex flex-col">
            
            {/* Title & Rating */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-3">{product.title}</h1>
            
            <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-6">
              <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md">
                <Star className="w-4 h-4 text-green-600 fill-current" />
                <span className="text-sm font-bold text-green-700">4.8</span>
              </div>
              <span className="text-sm text-gray-500">120 Reviews</span>
              <span className={`text-sm font-medium px-2 py-1 rounded-full ${stock > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
                {stock > 0 ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">GH₵ {price.toFixed(2)}</span>
                {price > 0 && (
                  <span className="text-lg text-gray-400 line-through">GH₵ {(price * 1.2).toFixed(2)}</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Inclusive of all taxes</p>
            </div>

            {/* Description */}
            <div className="prose prose-sm text-gray-600 mb-8 leading-relaxed">
              <p>{product.description || "No description available for this product."}</p>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Truck className="w-5 h-5 text-green-600" />
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Fast Delivery</p>
                  <p className="text-gray-500">Within 2-3 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Secure Payment</p>
                  <p className="text-gray-500">100% Protected</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <AddToCartButton 
                product={{
                  id: product.id,
                  title: product.title,
                  slug: product.slug,
                  images: product.images.map(img => ({ url: img.url }))
                }}
                bestOfferId={bestOffer?.id}
                bestVariantId={product.variants[0]?.id}
                price={price}
                stock={stock}
                sellerId={seller?.id}
                sellerName={seller?.businessName}
              />
              
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Check className="w-4 h-4 text-green-600" />
                <span>Free return within 7 days</span>
              </div>
            </div>

          </div>
        </div>

        {/* SELLER & CHAT SECTION (Full Width Below) */}
        {seller && (
          <div className="mt-16 border-t border-gray-200 pt-10">
            <div className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Sold by {seller.businessName}</h3>
                  <p className="text-sm text-gray-500 mt-1">Verified Seller • 98% Positive Ratings</p>
                </div>
                
                {session ? (
                  <div className="w-full md:w-96">
                    {conversationId ? (
                      <div className="h-64">
                         <ChatBox conversationId={conversationId} initialMessages={initialMessages} />
                      </div>
                    ) : (
                      <StartChatButton 
                        receiverId={seller.userId}
                        productId={product.id}
                        productName={product.title}
                      />
                    )}
                  </div>
                ) : (
                  <Link href="/login" className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">
                    Log in to chat
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS SECTION */}
        <div className="mt-16">
          <ReviewSection productSlug={product.slug} />
        </div>

      </div>
    </div>
  );
}
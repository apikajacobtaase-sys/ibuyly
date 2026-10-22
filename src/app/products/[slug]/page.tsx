 // src/app/products/[slug]/page.tsx
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Star, Truck, ShieldCheck, MessageCircle } from "lucide-react";
import ReviewSection from "@/components/product/ReviewSection";
import AddToCartButton from "@/components/product/AddToCartButton";
import ChatBox from "@/components/chat/ChatBox";
import StartChatButton from "@/components/chat/StartChatButton"; // ✅ Import the new client component

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
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-white min-h-screen">
      
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-green-600">Home</Link> / 
        <Link href="/categories" className="hover:text-green-600 ml-1">Categories</Link> / 
        <span className="text-gray-900 ml-1">{product.category?.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        <div className="lg:col-span-2">
          <div className="space-y-4 mb-8">
            <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">
              {product.images[0] ? (
                <Image 
                  src={product.images[0].url} 
                  alt={product.title} 
                  fill 
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  priority 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
              )}
            </div>
          </div>

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
  // ✅ Pass these new props
  sellerId={seller?.id}
  sellerName={seller?.businessName}
/>
        </div>

        <div className="space-y-6">
          {seller && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-gray-900 mb-2">Sold by {seller.businessName}</h3>
              
              {session ? (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Chat with Seller
                  </h4>
                  
                  {conversationId ? (
                    <ChatBox conversationId={conversationId} initialMessages={initialMessages} />
                  ) : (
                    // ✅ Use the Client Component here instead of a raw button
                    <StartChatButton 
                      receiverId={seller.userId}
                      productId={product.id}
                      productName={product.title}
                    />
                  )}
                </div>
              ) : (
                <Link href="/login" className="block w-full text-center py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Log in to contact seller
                </Link>
              )}
            </div>
          )}
        </div>

      </div>

      <ReviewSection productSlug={product.slug} />
    </div>
  );
}
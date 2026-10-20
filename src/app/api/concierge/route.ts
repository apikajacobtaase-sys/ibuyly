// src/app/api/concierge/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

// Only initialize OpenAI if the key exists
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

export async function POST(req: Request) {
  try {
    const { message, conversationHistory } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let intent: any = null;

    // 1. Try OpenAI if key is available
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", 
          messages: [
            {
              role: "system",
              content: `You are an intelligent shopping assistant for iBUY. Analyze the user's message and extract intent into STRICT JSON. 
              Schema: { "category": "string or null", "maxPrice": number or null, "keywords": ["string"] or null, "needsClarification": boolean, "clarificationQuestion": "string or null" }`
            },
            ...(conversationHistory || []),
            { role: "user", content: message }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });

        intent = JSON.parse(completion.choices[0].message.content || "{}");
        
        if (intent.needsClarification && intent.clarificationQuestion) {
          return NextResponse.json({ reply: intent.clarificationQuestion, products: [], intent });
        }
      } catch (aiError) {
        console.warn("⚠️ OpenAI failed, falling back to Smart Offline Mode:", aiError);
      }
    }

    // 2. SMART OFFLINE MODE: Extract intent using Regex/Keywords if OpenAI is unavailable
    if (!intent) {
      console.log("🧠 Using Smart Offline Mode (Keyword & Budget Extraction)");
      
      const lowerMsg = message.toLowerCase();
      
      // Extract numbers for max budget (e.g., "under 5000" -> 5000)
      const priceMatches = message.match(/\d+/g);
      const maxPrice = priceMatches ? Math.max(...priceMatches.map(Number)) : undefined;

      // Extract keywords (filter out stop words and numbers)
      const stopWords = ['i', 'need', 'a', 'an', 'the', 'for', 'with', 'under', 'below', 'around', 'about', 'looking', 'want', 'to', 'buy', 'get', 'me', 'show', 'ghs', 'ghc', 'cedis', 'please', 'can', 'you'];
      const keywords = lowerMsg
        .replace(/[^\w\s]/gi, '')
        .split(' ')
        .filter(word => word.length > 2 && !stopWords.includes(word) && !/^\d+$/.test(word));

      intent = { category: null, maxPrice, keywords: keywords.length > 0 ? keywords : null, isOfflineMode: true };
    }

    // 3. Build Prisma Query based on extracted intent
    const whereClause: any = { status: "ACTIVE" };

    if (intent.category) {
      whereClause.category = { name: { contains: intent.category, mode: "insensitive" } };
    }

    if (intent.maxPrice) {
      whereClause.variants = { some: { price: { lte: intent.maxPrice } } };
    }

    if (intent.keywords && intent.keywords.length > 0) {
      whereClause.OR = intent.keywords.map((keyword: string) => ({
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
          { category: { name: { contains: keyword, mode: "insensitive" } } }
        ]
      }));
    }

    // 4. Query Database
    const products = await db.product.findMany({
      where: whereClause,
      include: {
        variants: { take: 1 },
        images: { where: { isPrimary: true }, take: 1 },
        category: { select: { name: true } },
        seller: { select: { businessName: true } }
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    });

    const formattedProducts = products.map((p) => {
      const variant = p.variants[0];
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        price: variant?.price ? parseFloat(variant.price.toString()) : 0,
        imageUrl: p.images[0]?.url || null,
        categoryName: p.category.name,
        sellerName: p.seller.businessName,
        stockQuantity: variant?.stockQuantity || 0,
        variants: p.variants, // Keep for frontend compatibility
        images: p.images,
        seller: p.seller
      };
    });

    // 5. Generate Reply
    let reply = "";
    if (formattedProducts.length > 0) {
      const budgetText = intent.maxPrice ? ` under GH₵ ${intent.maxPrice}` : "";
      reply = `I found ${formattedProducts.length} great option${formattedProducts.length > 1 ? 's' : ''} for you${budgetText}! Here are my top recommendations.`;
    } else {
      reply = `I couldn't find exact matches for that right now. Try broadening your search or adjusting your budget!`;
    }

    return NextResponse.json({
      reply,
      products: formattedProducts,
      intent,
    });

  } catch (error: any) {
    console.error("❌ Concierge API Fatal Error:", error);
    return NextResponse.json({
      reply: "I'm having a little trouble searching the catalog right now. Please try again in a moment!",
      products: [],
      isFallback: true,
    }, { status: 500 });
  }
}
// src/app/api/seller/ai/analyze-listing/route.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";

 const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-dummy-key-for-build",
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, imageCount, attributes } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    // Construct the prompt for the AI
    const prompt = `
      You are an expert e-commerce listing optimizer. Analyze the following product listing and provide:
      1. A quality score from 0 to 100.
      2. Up to 3 specific, actionable suggestions to improve the listing and increase sales.

      Product Details:
      - Title: "${title}"
      - Description: "${description}"
      - Number of Images: ${imageCount}
      - Attributes: ${JSON.stringify(attributes || {})}

      Scoring Guidelines:
      - Title should be descriptive and include key features (e.g., brand, model, size).
      - Description should be detailed, mention benefits, specifications, and use cases.
      - At least 3 images are highly recommended.
      - Attributes (like brand, color, material) add significant value.

      Respond ONLY with a valid JSON object in this exact format:
      {
        "score": number,
        "suggestions": ["string", "string", "string"]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast, cheap, and highly capable
      messages: [
        { role: "system", content: "You are a helpful e-commerce listing expert. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Keep it focused and consistent
      response_format: { type: "json_object" },
    });

    const resultText = completion.choices[0].message.content;
    
    if (!resultText) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(resultText);

    return NextResponse.json({
      score: result.score,
      suggestions: result.suggestions,
    });
  } catch (error: any) {
    console.error("🚨 AI Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze listing" },
      { status: 500 }
    );
  }
}
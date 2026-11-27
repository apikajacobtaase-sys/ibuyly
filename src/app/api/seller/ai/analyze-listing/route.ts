 import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { authorizeSeller } from "@/lib/seller-auth";

const ai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const RequestSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(10000),
  imageCount: z.number().int().min(0).max(10),
  attributes: z.record(z.string(), z.unknown()).optional(),
  category: z.string().max(100).optional(),
});

const ResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  optimizedTitle: z.string().min(2).max(200),
  optimizedDescription: z.string().min(10).max(10000),
  attributes: z.record(z.string(), z.unknown()),
  semanticTags: z.array(z.string().min(1).max(60)).max(20),
  suggestions: z.array(z.string().min(1).max(300)).max(5),
});

export async function POST(req: Request) {
  try {
    const auth = await authorizeSeller("manage_products");

    if (!auth.authorized) return auth.response;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "AI is not configured." },
        { status: 503 }
      );
    }

    const validation = RequestSchema.safeParse(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid listing information." },
        { status: 400 }
      );
    }

    const { title, description, imageCount, attributes, category } =
      validation.data;

    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
You are the iBUY Africa Product Intelligence Assistant.

Analyze and improve e-commerce product listings.

RULES:
- Never assume a product specification based on common models or market standards.
- If a supplied specification appears unusual or inconsistent, flag it for seller verification.
- Do not replace seller-provided specifications with assumed alternatives.
- Distinguish verified product facts from information that still needs confirmation.
- Never invent brands, models, specifications, warranties or certifications.
- Only extract facts supported by supplied information.
- Improve titles for clarity and product search.
- Write informative, natural product descriptions.
- Consider Ghanaian and African buyer search behaviour.
- Generate relevant semantic search tags.
- Score listing quality from 0 to 100.
- Provide practical improvement suggestions.
- Return ONLY valid JSON.

REQUIRED JSON:
{
  "score": 85,
  "optimizedTitle": "Improved product title",
  "optimizedDescription": "Improved product description",
  "attributes": {},
  "semanticTags": [],
  "suggestions": []
}
          `,
        },
        {
          role: "user",
          content: JSON.stringify({
            title,
            description,
            category: category || "Unspecified",
            imageCount,
            attributes: attributes || {},
          }),
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("AI returned an empty response.");
    }

    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let result: unknown;

    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("Invalid AI JSON response:", content);

      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const parsed = ResultSchema.safeParse(result);

    if (!parsed.success) {
      console.error("Invalid AI analysis:", parsed.error.flatten());

      return NextResponse.json(
        { error: "AI returned an invalid listing analysis." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      ...parsed.data,
    });
  } catch (error) {
    console.error("AI listing analysis error:", error);

    return NextResponse.json(
      { error: "Unable to analyse this listing. Please try again." },
      { status: 502 }
    );
  }
}
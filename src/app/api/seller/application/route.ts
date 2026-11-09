import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const AnswerSchema = z.object({
  questionId: z.string().min(1).max(80),
  value: z.union([
    z.string().max(5000),
    z.boolean(),
  ]),
});

const UpdateApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessType: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
  answers: z.array(AnswerSchema).max(20).optional(),
});

type Question = {
  id: string;
  question: string;
  type: "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE";
};

function parseQuestions(value: Prisma.JsonValue): Question[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is Question => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const question = item as Record<string, unknown>;

    return (
      typeof question.id === "string" &&
      typeof question.question === "string" &&
      ["SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE"].includes(
        question.type as string
      )
    );
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to view your application." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Your account is unavailable." },
        { status: 403 }
      );
    }

    const application = await db.sellerApplication.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        description: true,
        status: true,
        adminNotes: true,
        rejectionReason: true,
        requestedQuestions: true,
        submittedAnswers: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      application: application
        ? {
            ...application,
            requestedQuestions: parseQuestions(
              application.requestedQuestions
            ),
          }
        : null,
    });
  } catch (error) {
    console.error("Fetch seller application error:", error);

    return NextResponse.json(
      { error: "Unable to load your seller application." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to update your application." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isActive: true,
        sellerProfile: { select: { id: true } },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Your account is unavailable." },
        { status: 403 }
      );
    }

    if (user.sellerProfile) {
      return NextResponse.json(
        { error: "You already have an active seller account." },
        { status: 409 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = UpdateApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Please provide valid business information and answers.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const application = await db.sellerApplication.findFirst({
      where: {
        userId: user.id,
        status: "NEEDS_INFO",
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        businessName: true,
        requestedQuestions: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        {
          error: "There is no application awaiting additional information from you.",
        },
        { status: 409 }
      );
    }

    const questions = parseQuestions(application.requestedQuestions);

    if (questions.length > 0) {
      const answers = validation.data.answers;

      if (!answers || answers.length !== questions.length) {
        return NextResponse.json(
          { error: "Please answer every question before resubmitting." },
          { status: 400 }
        );
      }

      const questionIds = new Set(questions.map((question) => question.id));
      const submittedIds = new Set(answers.map((answer) => answer.questionId));

      if (
        submittedIds.size !== answers.length ||
        answers.some((answer) => !questionIds.has(answer.questionId))
      ) {
        return NextResponse.json(
          { error: "The submitted answers do not match the requested questions." },
          { status: 400 }
        );
      }

      for (const question of questions) {
        const answer = answers.find(
          (item) => item.questionId === question.id
        );

        if (!answer) {
          return NextResponse.json(
            { error: `Please answer: ${question.question}` },
            { status: 400 }
          );
        }

        if (question.type === "TRUE_FALSE") {
          if (typeof answer.value !== "boolean") {
            return NextResponse.json(
              { error: `Please select True or False for: ${question.question}` },
              { status: 400 }
            );
          }
        } else {
          if (
            typeof answer.value !== "string" ||
            answer.value.trim().length === 0
          ) {
            return NextResponse.json(
              { error: `Please provide an answer for: ${question.question}` },
              { status: 400 }
            );
          }

          if (
            question.type === "SHORT_ANSWER" &&
            answer.value.trim().length > 500
          ) {
            return NextResponse.json(
              { error: `Your answer to "${question.question}" must not exceed 500 characters.` },
              { status: 400 }
            );
          }
        }
      }
    }

    const updated = await db.sellerApplication.updateMany({
      where: {
        id: application.id,
        userId: user.id,
        status: "NEEDS_INFO",
      },
      data: {
        businessName: validation.data.businessName,
        businessType: validation.data.businessType,
        description: validation.data.description,
        ...(questions.length > 0
          ? {
              submittedAnswers:
                validation.data.answers as Prisma.InputJsonValue,
            }
          : {}),
        status: "PENDING",
      },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        {
          error: "Your application has changed. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    await logAudit({
      userId: user.id,
      action: "SELLER_APPLICATION_RESUBMITTED",
      resourceType: "SellerApplication",
      resourceId: application.id,
      metadata: {
        previousBusinessName: application.businessName,
        businessName: validation.data.businessName,
        answeredQuestions: validation.data.answers?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Your updated application and answers have been submitted successfully.",
    });
  } catch (error) {
    console.error("Seller application update error:", error);

    return NextResponse.json(
      { error: "Unable to update your application. Please try again." },
      { status: 500 }
    );
  }
}
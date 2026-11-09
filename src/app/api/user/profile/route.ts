import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);

    return NextResponse.json(
      { error: "Failed to load your profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { firstName, lastName, phone } = body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      (phone !== null && phone !== undefined && typeof phone !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid profile details." },
        { status: 400 }
      );
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone =
      typeof phone === "string" ? phone.trim() || null : null;

    if (!cleanFirstName || !cleanLastName) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (cleanFirstName.length > 80 || cleanLastName.length > 80) {
      return NextResponse.json(
        { error: "Names cannot exceed 80 characters." },
        { status: 400 }
      );
    }

    if (cleanPhone && cleanPhone.length > 30) {
      return NextResponse.json(
        { error: "Phone number is too long." },
        { status: 400 }
      );
    }

    if (cleanPhone) {
      const existingPhone = await db.user.findFirst({
        where: {
          phone: cleanPhone,
          id: { not: session.user.id },
        },
        select: { id: true },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: "This phone number is already associated with another account." },
          { status: 409 }
        );
      }
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phone: cleanPhone,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return NextResponse.json(
      { error: "Failed to update your profile." },
      { status: 500 }
    );
  }
}

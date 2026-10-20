// src/app/api/addresses/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, address, city, region, label } = body;

    const newAddress = await db.address.create({
      data: {
        userId: session.user.id,
        name,
        phone,
        address,
        city,
        region,
        label: label || "Home",
      },
    });

    return NextResponse.json({ success: true, address: newAddress }, { status: 201 });
  } catch (error: any) {
    console.error("Address creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// src/app/api/test-db/route.ts

import { db } from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Ask the database to count how many users exist (should be 0 right now)
    const userCount = await db.user.count();
    
    return NextResponse.json({ 
      success: true, 
      message: "🎉 iBUY Database connected successfully!", 
      userCount 
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return NextResponse.json(
      { success: false, error: "Database connection failed" }, 
      { status: 500 }
    );
  }
}
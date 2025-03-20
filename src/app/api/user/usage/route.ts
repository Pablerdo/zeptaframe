import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/drizzle";
import { videoGenerations, imageGenerations } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Get the start of the current day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Query for video generations used today
    const todayVideoGenerations = await db
      .select({ id: videoGenerations.id })
      .from(videoGenerations)
      .where(
        and(
          eq(videoGenerations.userId, userId),
          gte(videoGenerations.createdAt, today)
        )
      );
    
    // Query for image generations used today
    const todayImageGenerations = await db
      .select({ id: imageGenerations.id })
      .from(imageGenerations)
      .where(
        and(
          eq(imageGenerations.userId, userId),
          gte(imageGenerations.createdAt, today)
        )
      );
    
    return NextResponse.json({
      videoGenerationsUsed: todayVideoGenerations.length,
      imageGenerationsUsed: todayImageGenerations.length
    });
    
  } catch (error) {
    console.error("Error fetching user usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
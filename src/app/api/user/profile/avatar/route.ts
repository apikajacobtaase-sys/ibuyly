import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Image upload is not configured." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an image." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be larger than 0 bytes and no larger than 5 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let imageMetadata;

    try {
      imageMetadata = await sharp(buffer, {
        limitInputPixels: 40000000,
      }).metadata();
    } catch {
      return NextResponse.json(
        { error: "The uploaded file is corrupted or is not a valid image." },
        { status: 400 }
      );
    }

    const expectedFormats: Record<string, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };

    if (
      !imageMetadata.format ||
      imageMetadata.format !== expectedFormats[file.type]
    ) {
      return NextResponse.json(
        { error: "The uploaded file is not a valid image of the selected type." },
        { status: 400 }
      );
    }

    const uploaded = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "ibuy/profiles",
          resource_type: "image",
          transformation: [
            { width: 600, height: 600, crop: "limit" },
          ],
        },
        (error, result) => {
          if (error) return reject(error);

          if (!result) {
            return reject(new Error("Cloudinary returned no result."));
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      stream.end(buffer);
    });

    const user = await db.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: uploaded.secure_url },
      select: {
        id: true,
        avatarUrl: true,
        firstName: true,
        lastName: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile photo updated.",
      user,
      publicId: uploaded.public_id,
    });
  } catch (error) {
    console.error("Profile photo upload error:", error);

    return NextResponse.json(
      { error: "Failed to upload profile photo." },
      { status: 500 }
    );
  }
}

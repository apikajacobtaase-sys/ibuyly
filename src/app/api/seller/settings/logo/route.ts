import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeSeller } from "@/lib/seller-auth";
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
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the store owner can change the store logo." },
        { status: 403 }
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
        { error: "Please select a store logo." },
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
        { error: "Logo must be larger than 0 bytes and no larger than 5 MB." },
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
          folder: "ibuy/stores",
          resource_type: "image",
          transformation: [
            { width: 800, height: 800, crop: "limit" },
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

    const updated = await db.sellerProfile.updateMany({
      where: {
        id: access.sellerId,
        userId: access.userId,
        isActive: true,
        verificationStatus: "VERIFIED",
      },
      data: {
        logoUrl: uploaded.secure_url,
      },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Store logo could not be updated." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Store logo updated successfully.",
      logoUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  } catch (error) {
    console.error("Store logo upload error:", error);

    return NextResponse.json(
      { error: "Failed to upload store logo." },
      { status: 500 }
    );
  }
}

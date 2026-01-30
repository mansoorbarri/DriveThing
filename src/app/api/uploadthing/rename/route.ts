import { auth } from "@clerk/nextjs/server";
import { UTApi } from "uploadthing/server";
import { NextResponse } from "next/server";

const utapi = new UTApi();

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fileKey, newName } = await request.json() as { fileKey: string; newName: string };

    if (!fileKey || !newName) {
      return NextResponse.json({ error: "File key and new name required" }, { status: 400 });
    }

    await utapi.renameFiles({
      fileKey,
      newName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to rename file on UploadThing:", error);
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 }
    );
  }
}

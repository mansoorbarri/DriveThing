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
    const body = await request.json() as { fileKey?: string; fileKeys?: string[] };
    const { fileKey, fileKeys } = body;

    // Handle both single fileKey and array of fileKeys
    const keysToDelete = fileKeys ?? (fileKey ? [fileKey] : []);

    if (keysToDelete.length === 0) {
      return NextResponse.json({ error: "File key(s) required" }, { status: 400 });
    }

    await utapi.deleteFiles(keysToDelete);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete file from UploadThing:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

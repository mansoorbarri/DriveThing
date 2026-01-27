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
    const { fileKey } = await request.json() as { fileKey: string };

    if (!fileKey) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    await utapi.deleteFiles(fileKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete file from UploadThing:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

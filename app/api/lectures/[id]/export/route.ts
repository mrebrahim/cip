import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markdownToDocx, safeFileName } from "@/lib/docx";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل دخول." }, { status: 401 });
  }

  const { data: lecture } = await supabase
    .from("lectures")
    .select("title, document_md")
    .eq("id", id)
    .maybeSingle();

  if (!lecture) {
    return NextResponse.json({ error: "المحاضرة دي مش موجودة." }, { status: 404 });
  }
  if (!lecture.document_md) {
    return NextResponse.json({ error: "المستند لسه مش جاهز." }, { status: 409 });
  }

  const buffer = await markdownToDocx(lecture.document_md, lecture.title);
  const fileName = `${safeFileName(lecture.title)}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // RFC 5987 encoding keeps the Arabic title intact in the saved filename.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

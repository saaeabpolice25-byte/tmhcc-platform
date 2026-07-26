// app/api/liff-report/route.js
// รับข้อมูลเปิดเหตุจากฟอร์ม LIFF (app/liff/report) — ผู้ใช้ LIFF ไม่มี Firebase Auth session
// จึงต้อง sign in ด้วยบัญชีระบบก่อนเขียน Firestore เหมือนกับ line-webhook
import { NextResponse } from "next/server";
import { ensureServerAuth } from "@/firebase/serverAuth";
import { createIncident } from "@/services/incidentService";

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, patientName, title, level, village, location, lineUserId, lineDisplayName } = body;

    if (!type || !title || !level) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    await ensureServerAuth();

    const origin = new URL(request.url).origin;
    const result = await createIncident(
      {
        type,
        patientName,
        title,
        level,
        village,
        location: location || null,
        createdBy: lineDisplayName || "ผู้ใหญ่บ้าน (LINE)",
        createdByLineUserId: lineUserId || null,
        reportedVia: "LIFF",
      },
      origin
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("LIFF report error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// app/api/liff-report/route.js
// รับข้อมูลเปิดเหตุจากฟอร์ม LIFF (app/liff/report) — ผู้ใช้ LIFF ไม่มี Firebase Auth session
// จึงต้อง sign in ด้วยบัญชีระบบก่อนเขียน Firestore เหมือนกับ line-webhook
import { NextResponse } from "next/server";
import { ensureServerAuth } from "@/firebase/serverAuth";
import { createIncident } from "@/services/incidentService";

// ตรวจสอบกับ LINE เองว่า accessToken ที่ส่งมาเป็นของจริง และออกให้กับ LIFF/ช่องของเราเท่านั้น
// ป้องกันไม่ให้ใครก็ได้ที่รู้ URL นี้ปลอมข้อมูลเหตุการณ์ส่งเข้ามาตรงๆ โดยไม่ผ่าน LINE จริง
const verifyLiffAccessToken = async (accessToken) => {
  if (!accessToken) return false;
  try {
    const res = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return false;
    const data = await res.json();
    const expectedChannelId = (process.env.NEXT_PUBLIC_LIFF_ID || "").split("-")[0];
    return Boolean(expectedChannelId) && String(data.client_id) === expectedChannelId;
  } catch {
    return false;
  }
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { accessToken, type, patientName, title, level, village, location, lineUserId, lineDisplayName } = body;

    if (!(await verifyLiffAccessToken(accessToken))) {
      return NextResponse.json({ success: false, error: "ยืนยันตัวตนจาก LINE ไม่สำเร็จ กรุณาเปิดฟอร์มนี้ผ่านปุ่มในกลุ่ม LINE ใหม่อีกครั้ง" }, { status: 401 });
    }

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
      origin,
      process.env.INTERNAL_API_SECRET
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

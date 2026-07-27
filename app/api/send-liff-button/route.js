// app/api/send-liff-button/route.js
// ส่ง Flex message ปุ่ม "เปิดเหตุฉุกเฉิน" (ลิงก์ LIFF) เข้ากลุ่ม LINE ของหน่วยงานที่ระบุ
// กดจากหน้า /units (เฉพาะ ADMIN) — หลังส่งแล้วให้คนในกลุ่มกดค้างที่ข้อความ > ปักหมุด เพื่อไม่ให้หายไปในประวัติแชท
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/firebase/admin";

export async function POST(request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ success: false, error: "ระบบยังไม่ได้ตั้งค่า Firebase Admin SDK" }, { status: 500 });
  }

  try {
    const { idToken, unitCode } = await request.json();

    if (!idToken) {
      return NextResponse.json({ success: false, error: "ไม่ได้ล็อกอิน" }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, error: "เซสชันไม่ถูกต้อง กรุณาล็อกอินใหม่" }, { status: 401 });
    }
    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerSnap.exists || callerSnap.data().role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ทำรายการนี้ได้" }, { status: 403 });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!channelAccessToken) {
      return NextResponse.json({ success: false, error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 });
    }
    if (!liffId) {
      return NextResponse.json({ success: false, error: "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID" }, { status: 500 });
    }

    const unitSnap = await adminDb.collection("units").doc(unitCode).get();
    const unitData = unitSnap.exists ? unitSnap.data() : null;
    if (!unitData || !unitData.active || !unitData.lineGroupId) {
      return NextResponse.json({ success: false, error: "หน่วยนี้ยังไม่มี LINE Group ID" }, { status: 400 });
    }

    const message = {
      type: "flex",
      altText: "🚨 ปุ่มเปิดเหตุฉุกเฉิน TMHCC",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: "🚨 TMHCC", weight: "bold", size: "lg", color: "#DC2626" },
            { type: "text", text: `สำหรับหน่วย ${unitData.unitLabel} — กดปุ่มด้านล่างเมื่อพบเหตุฉุกเฉิน`, size: "sm", wrap: true, color: "#475569" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#DC2626",
              action: { type: "uri", label: "เปิดเหตุฉุกเฉิน", uri: `https://liff.line.me/${liffId}` },
            },
            { type: "text", text: "แนะนำ: กดค้างที่ข้อความนี้ > ปักหมุด ให้อยู่ด้านบนกลุ่มถาวร", size: "xxs", color: "#94A3B8", wrap: true, margin: "sm" },
          ],
        },
      },
    };

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
      body: JSON.stringify({ to: unitData.lineGroupId, messages: [message] }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json({ success: false, error: errData.message || "ส่งไม่สำเร็จ" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

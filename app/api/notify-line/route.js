// app/api/notify-line/route.js
import { NextResponse } from "next/server";

const typeLabels = {
  SUICIDE_RISK: "เสี่ยงฆ่าตัวตาย",
  CRAZED: "คลุ้มคลั่ง",
  DRUGS: "ยาเสพติด",
  MISSING_MEDS: "ขาดยา",
  RELAPSE: "อาการกำเริบ",
};

export async function POST(request) {
  try {
    const incidentData = await request.json();

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetUserId = process.env.LINE_TARGET_USER_ID;

    if (!channelAccessToken || !targetUserId) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_TARGET_USER_ID ยังไม่ได้ถูกตั้งค่าใน Environment Variables");
      return NextResponse.json({ success: false, error: "Missing LINE credentials" }, { status: 500 });
    }

    const thaiType = typeLabels[incidentData.type] || incidentData.type;
    const levelEmoji = incidentData.level === "RED" ? "🔴" : incidentData.level === "ORANGE" ? "🟠" : "🟡";

    const messageText =
      `${levelEmoji} INCIDENT: ${incidentData.id}\n\n` +
      `ประเภท: ${thaiType}\n` +
      `ระดับ: ${incidentData.level}\n` +
      `พื้นที่: ${incidentData.village}\n` +
      `รายละเอียด: ${incidentData.title}\n\n` +
      `งานของคุณ: รพ.สต. / ผู้ปฏิบัติงาน\n` +
      `กรุณากดยืนยันรับงานในระบบ TMHCC Platform`;

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: targetUserId,
        messages: [{ type: "text", text: messageText }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("LINE API Error Response:", errData);
      return NextResponse.json({ success: false, error: errData.message || "Failed to send LINE notification" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE Notify Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

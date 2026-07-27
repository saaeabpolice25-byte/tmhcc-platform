// app/api/notify-line/route.js
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/firebase/admin";

const typeLabels = {
  SUICIDE_RISK: "เสี่ยงฆ่าตัวตาย",
  CRAZED: "คลุ้มคลั่ง",
  DRUGS: "ยาเสพติด",
  MISSING_MEDS: "ขาดยา",
  RELAPSE: "อาการกำเริบ",
};

const LEVEL_COLOR = { RED: "#DC2626", ORANGE: "#EA580C", YELLOW: "#CA8A04" };
const LEVEL_EMOJI = { RED: "🔴", ORANGE: "🟠", YELLOW: "🟡" };
const LEVEL_LABEL = { RED: "วิกฤต", ORANGE: "เร่งด่วน", YELLOW: "ติดตามอาการ" };

const PSYCH_HISTORY_LABEL = {
  HAS_HISTORY: "มีประวัติการรักษาทางจิตเวช",
  NO_HISTORY: "ไม่มีประวัติการรักษาทางจิตเวช",
  UNKNOWN: "ไม่ทราบ",
};

// ผู้เรียกต้องเป็นอย่างใดอย่างหนึ่ง: (1) ผู้ใช้ที่ login จริงในเว็บ (ส่ง idToken มา)
// (2) เซิร์ฟเวอร์ของเราเอง (line-webhook / liff-report ที่ตรวจสอบผู้ส่งมาแล้วชั้นหนึ่ง — ส่ง internalSecret มาแทน)
// ป้องกันไม่ให้ใครก็ได้ที่รู้ URL นี้ยิงเข้ามาสั่งให้ระบบส่งข้อความเท็จเข้ากลุ่ม LINE จริง
const verifyCaller = async (idToken, internalSecret) => {
  if (internalSecret && process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET) {
    return true;
  }
  if (idToken) {
    try {
      await adminAuth.verifyIdToken(idToken);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const buildFlexMessage = (incident) => {
  const { incidentCode, type, level, village, title, patientName, psychHistory, taskId, unitCode, unit, task, location } = incident;
  const thaiType = typeLabels[type] || type;
  const psychLabel = PSYCH_HISTORY_LABEL[psychHistory] || null;
  const color = LEVEL_COLOR[level] || LEVEL_COLOR.YELLOW;
  const emoji = LEVEL_EMOJI[level] || "🟡";
  const levelLabel = LEVEL_LABEL[level] || level;

  const postbackData = new URLSearchParams({
    action: "complete",
    taskId,
    incidentCode,
    unitCode,
  }).toString();

  const footerButtons = [
    {
      type: "button",
      style: "primary",
      color: "#2563EB",
      action: {
        type: "postback",
        label: "ดำเนินการแล้ว",
        data: postbackData,
        displayText: "ยืนยันดำเนินการแล้ว",
      },
    },
  ];

  if (location && location.lat && location.lng) {
    footerButtons.push({
      type: "button",
      style: "secondary",
      action: {
        type: "uri",
        label: "📍 เปิดแผนที่ไปที่เกิดเหตุ",
        uri: `https://www.google.com/maps?q=${location.lat},${location.lng}`,
      },
    });
  }

  return {
    type: "flex",
    altText: `${emoji} ${incidentCode} - งานของ${unit}: ${task}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: color,
        paddingAll: "16px",
        contents: [
          { type: "text", text: `${emoji} เหตุการณ์${levelLabel}`, color: "#FFFFFF", weight: "bold", size: "sm" },
          { type: "text", text: incidentCode, color: "#FFFFFF", weight: "bold", size: "lg" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `ประเภท: ${thaiType}`, size: "sm", wrap: true, color: "#475569" },
          ...(patientName ? [{ type: "text", text: `ผู้ป่วย: ${patientName}`, size: "sm", wrap: true, color: "#475569" }] : []),
          ...(psychLabel ? [{ type: "text", text: `ประวัติจิตเวช: ${psychLabel}`, size: "sm", wrap: true, color: "#475569" }] : []),
          { type: "text", text: `พื้นที่: ${village}`, size: "sm", wrap: true, color: "#475569" },
          { type: "text", text: `รายละเอียด: ${title}`, size: "sm", wrap: true, color: "#475569" },
          { type: "separator", margin: "md" },
          { type: "text", text: `ภารกิจของหน่วย ${unit}`, weight: "bold", size: "sm", margin: "md" },
          { type: "text", text: task, wrap: true, size: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerButtons,
      },
    },
  };
};

export async function POST(request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ success: false, error: "ระบบยังไม่ได้ตั้งค่า Firebase Admin SDK" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { unitCode, idToken, internalSecret } = body;

    const authorized = await verifyCaller(idToken, internalSecret);
    if (!authorized) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ถูกตั้งค่าใน Environment Variables");
      return NextResponse.json({ success: false, error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 });
    }

    // อ่าน Group ID ของหน่วยงานผ่าน Admin SDK (bypass rules ได้ ไม่ต้องพึ่ง public-read บน units อีกต่อไป)
    const unitSnap = await adminDb.collection("units").doc(unitCode).get();
    const unitData = unitSnap.exists ? unitSnap.data() : null;

    if (!unitData || !unitData.active || !unitData.lineGroupId) {
      console.warn(`หน่วย ${unitCode} ยังไม่มี LINE Group ID หรือปิดใช้งานอยู่ — ข้ามการแจ้งเตือน`);
      return NextResponse.json({ success: true, skipped: true });
    }

    const message = buildFlexMessage(body);

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ to: unitData.lineGroupId, messages: [message] }),
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

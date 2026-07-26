// app/api/notify-line/route.js
import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxFBGjS9VB8H6bd5I_b7R25eLZIm4YZss",
  authDomain: "tmhcc-platform.firebaseapp.com",
  projectId: "tmhcc-platform",
  storageBucket: "tmhcc-platform.firebasestorage.app",
  messagingSenderId: "978696478225",
  appId: "1:978696478225:web:2695b1f6635c28c6f89bb0",
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

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

const buildFlexMessage = (incident) => {
  const { incidentCode, type, level, village, title, taskId, unitCode, unit, task } = incident;
  const thaiType = typeLabels[type] || type;
  const color = LEVEL_COLOR[level] || LEVEL_COLOR.YELLOW;
  const emoji = LEVEL_EMOJI[level] || "🟡";
  const levelLabel = LEVEL_LABEL[level] || level;

  const postbackData = new URLSearchParams({
    action: "complete",
    taskId,
    incidentCode,
    unitCode,
  }).toString();

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
        contents: [
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
        ],
      },
    },
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { unitCode } = body;

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ถูกตั้งค่าใน Environment Variables");
      return NextResponse.json({ success: false, error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 });
    }

    // อ่าน Group ID ของหน่วยงานจาก collection "units" (อ่านได้แบบไม่ต้อง login ตาม firestore.rules)
    const unitSnap = await getDoc(doc(db, "units", unitCode));
    const unitData = unitSnap.exists() ? unitSnap.data() : null;

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

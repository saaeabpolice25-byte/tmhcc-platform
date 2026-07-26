// app/api/line-webhook/route.js
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, getDocs, query, where, limit } from "firebase/firestore";
import { ensureServerAuth } from "@/firebase/serverAuth";
import { advanceSopChain } from "@/services/sopService";
import { sendTaskNotification } from "@/services/notifyService";

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

const verifySignature = (rawBody, signatureHeader) => {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
};

const fetchActorName = async (source) => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  try {
    const url =
      source.type === "group"
        ? `https://api.line.me/v2/bot/group/${source.groupId}/member/${source.userId}`
        : `https://api.line.me/v2/bot/profile/${source.userId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${channelAccessToken}` } });
    if (!res.ok) return "เจ้าหน้าที่ (LINE)";
    const data = await res.json();
    return data.displayName || "เจ้าหน้าที่ (LINE)";
  } catch {
    return "เจ้าหน้าที่ (LINE)";
  }
};

// พิมพ์อะไรก็ได้ในกลุ่มหลังแอดบอทเข้ากลุ่ม บอทจะตอบ Group ID กลับมาให้ก็อปไปกรอกที่หน้า /units
const replyWithSourceId = async (event) => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const idLine =
    event.source.type === "group"
      ? `Group ID:\n${event.source.groupId}`
      : event.source.type === "room"
      ? `Room ID:\n${event.source.roomId}`
      : `User ID:\n${event.source.userId}`;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `🔧 ${idLine}\n\nเอาไปกรอกที่หน้า /units ของระบบ TMHCC` }],
    }),
  });
};

const handlePostback = async (event, origin) => {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get("action");
  const taskId = params.get("taskId");
  if (action !== "complete" || !taskId) return;

  await ensureServerAuth();

  const taskRef = doc(db, "tasks", taskId);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) return;

  const task = taskSnap.data();
  if (task.status === "COMPLETED") return; // กันกดซ้ำ

  const actor = await fetchActorName(event.source);
  const now = new Date();

  const updates = {
    status: "COMPLETED",
    completedAt: serverTimestamp(),
    completedBy: actor,
    history: arrayUnion({
      status: "COMPLETED",
      actorType: "LINE",
      actorId: event.source.userId || null,
      actorDisplayName: actor,
      timestamp: now,
      note: null,
    }),
  };
  if (!task.acknowledgedAt) {
    updates.acknowledgedAt = now;
    updates.acknowledgedBy = actor;
  }

  await updateDoc(taskRef, updates);

  // เป็นขั้นตอนอัตโนมัติของ SOP (ไม่ใช่ภารกิจเสริมอย่างตำรวจ) -> สร้าง+แจ้งเตือนขั้นถัดไปในโซ่
  if (task.stepOrder != null && !task.isConditional) {
    const advanceResult = await advanceSopChain(task.incidentId, task.stepOrder);
    if (advanceResult.success && advanceResult.task) {
      const incSnap = await getDocs(query(collection(db, "incidents"), where("id", "==", task.incidentId), limit(1)));
      if (!incSnap.empty) {
        await sendTaskNotification(incSnap.docs[0].data(), advanceResult.task, origin);
      }
    }
  }
};

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody || "{}");
  const events = payload.events || [];
  const origin = new URL(request.url).origin;

  for (const event of events) {
    try {
      if (event.type === "postback") {
        await handlePostback(event, origin);
      } else if (event.type === "message" && event.message?.type === "text") {
        await replyWithSourceId(event);
      }
    } catch (error) {
      console.error("LINE webhook event error:", error);
    }
  }

  return NextResponse.json({ success: true });
}

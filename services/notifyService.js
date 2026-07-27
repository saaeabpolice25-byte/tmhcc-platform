// services/notifyService.js
import { auth } from "@/firebase/config";

// ส่งแจ้งเตือนภารกิจ "หนึ่ง task" ไปยังกลุ่ม LINE ของหน่วยงานที่รับผิดชอบ task นั้นโดยเฉพาะ
// Token/Group ID และการเรียก LINE API จริงอยู่ฝั่ง server เท่านั้น (app/api/notify-line/route.js)
// เพื่อไม่ให้ Channel Access Token หลุดไปอยู่ใน JS bundle ฝั่ง client
//
// baseUrl: ปล่อยว่างเมื่อเรียกจาก browser (ใช้ path สัมพัทธ์ได้เลย) แต่ต้องใส่ origin แบบเต็ม
// เมื่อเรียกจาก server route อื่น (เช่น line-webhook, liff-report) เพราะ fetch ฝั่ง server ใช้ path สัมพัทธ์ไม่ได้
//
// internalSecret: ใส่เฉพาะตอนเรียกจาก server route ของเราเอง (ที่ตรวจสอบผู้เรียกมาแล้วชั้นหนึ่ง เช่น
// line-webhook ผ่าน signature ของ LINE, liff-report ผ่าน LIFF access token) — ถ้าเรียกจาก browser
// จะดึง Firebase ID token ของผู้ใช้ที่ login อยู่มาส่งแทนโดยอัตโนมัติ ปลายทางต้องเห็นอย่างใดอย่างหนึ่งถึงจะยอมส่ง LINE จริง
export const sendTaskNotification = async (incident, task, baseUrl = "", internalSecret = null) => {
  try {
    let idToken = null;
    if (!internalSecret && typeof window !== "undefined" && auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }

    const response = await fetch(`${baseUrl}/api/notify-line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        internalSecret,
        incidentCode: incident.id,
        type: incident.type,
        level: incident.level,
        village: incident.village,
        title: incident.title,
        patientName: incident.patientName || "",
        location: incident.location || null,
        taskId: task.taskId,
        unitCode: task.unitCode,
        unit: task.unit,
        task: task.task,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      console.warn(`ไม่สามารถส่งแจ้งเตือน LINE ให้หน่วย ${task.unit} ได้:`, result.error);
      return { success: false, error: result.error || "Failed to send LINE notification" };
    }

    return { success: true, skipped: !!result.skipped };
  } catch (error) {
    // ป้องกันไม่ให้แอปพัง (Crash) หากเครือข่ายบล็อกการเชื่อมต่อ
    console.warn("ไม่สามารถเชื่อมต่อ /api/notify-line ได้:", error.message);
    return { success: false, error: error.message };
  }
};

// ยิงแจ้งเตือนให้ครบทุก task ที่เพิ่งสร้าง (ใช้ตอนเปิดเหตุใหม่ ซึ่งสร้างหลาย task พร้อมกัน)
export const sendTaskNotifications = async (incident, tasks, baseUrl = "", internalSecret = null) => {
  const results = await Promise.all(tasks.map((task) => sendTaskNotification(incident, task, baseUrl, internalSecret)));
  return results;
};

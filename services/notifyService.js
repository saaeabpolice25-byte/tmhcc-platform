// services/notifyService.js

// ฟังก์ชันส่งข้อความแจ้งเตือนผ่าน LINE Messaging API
// หมายเหตุ: Token และการเรียก LINE API จริงอยู่ฝั่ง server เท่านั้น (app/api/notify-line/route.js)
// เพื่อไม่ให้ Channel Access Token หลุดไปอยู่ใน JS bundle ฝั่ง client
export const sendLineNotification = async (incidentData) => {
  try {
    const response = await fetch("/api/notify-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incidentData),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      console.warn("ไม่สามารถส่งแจ้งเตือน LINE ได้:", result.error);
      return { success: false, error: result.error || "Failed to send LINE notification" };
    }

    return { success: true };
  } catch (error) {
    // ป้องกันไม่ให้แอปพัง (Crash) หากเครือข่ายบล็อกการเชื่อมต่อ
    console.warn("ไม่สามารถเชื่อมต่อ /api/notify-line ได้:", error.message);
    return { success: false, error: error.message };
  }
};

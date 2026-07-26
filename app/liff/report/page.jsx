// app/liff/report/page.jsx
"use client";

import { useState, useEffect } from "react";

const incidentTypes = [
  { id: "SUICIDE_RISK", label: "เสี่ยงฆ่าตัวตาย", defaultTitle: "ผู้มีภาวะเสี่ยงฆ่าตัวตาย" },
  { id: "CRAZED", label: "คลุ้มคลั่ง", defaultTitle: "ผู้ป่วยคลุ้มคลั่งอาละวาด" },
  { id: "DRUGS", label: "ยาเสพติด", defaultTitle: "ปัญหาเกี่ยวกับยาเสพติด" },
  { id: "MISSING_MEDS", label: "ขาดยา", defaultTitle: "ผู้ป่วยจิตเวชขาดยา" },
  { id: "RELAPSE", label: "อาการกำเริบ", defaultTitle: "อาการทางจิตเวชกำเริบ" },
];

export default function LiffReportPage() {
  const [liffObj, setLiffObj] = useState(null);
  const [liffError, setLiffError] = useState("");
  const [ready, setReady] = useState(false);

  const [selectedType, setSelectedType] = useState("SUICIDE_RISK");
  const [title, setTitle] = useState("ผู้มีภาวะเสี่ยงฆ่าตัวตาย");
  const [level, setLevel] = useState("RED");
  const [village, setVillage] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setLiffError("ยังไม่ได้ตั้งค่า LIFF ID ของระบบ (NEXT_PUBLIC_LIFF_ID) — ผู้ดูแลระบบต้องสร้าง LIFF app ก่อน");
      return;
    }
    (async () => {
      try {
        const liffModule = (await import("@line/liff")).default;
        await liffModule.init({ liffId });
        if (!liffModule.isLoggedIn() && !liffModule.isInClient()) {
          liffModule.login();
          return;
        }
        setLiffObj(liffModule);
        setReady(true);
      } catch (error) {
        setLiffError("เปิด LIFF ไม่สำเร็จ: " + error.message);
      }
    })();
  }, []);

  const handleTypeChange = (typeObj) => {
    setSelectedType(typeObj.id);
    setTitle(typeObj.defaultTitle);
  };

  const handleAttachLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (error) => {
        setLocationError("ดึงตำแหน่งไม่สำเร็จ: " + error.message + " (ต้องอนุญาตสิทธิ์เข้าถึงตำแหน่งก่อน)");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      let profile = { userId: null, displayName: "ผู้ใหญ่บ้าน (LINE)" };
      let context = null;
      if (liffObj) {
        try {
          profile = await liffObj.getProfile();
        } catch {
          // เปิดนอกแอป LINE หรือดึงโปรไฟล์ไม่ได้ ใช้ค่า default แทน
        }
        context = liffObj.getContext ? liffObj.getContext() : null;
      }

      const res = await fetch("/api/liff-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          level,
          village: village || "ไม่ระบุ",
          location,
          lineUserId: profile.userId,
          lineDisplayName: profile.displayName,
          groupId: context && context.type === "group" ? context.groupId : null,
        }),
      });
      const result = await res.json().catch(() => ({}));

      if (result.success) {
        setSuccessMsg("เปิดเหตุสำเร็จ! แจ้งเตือนหน่วยผู้ใหญ่บ้านแล้ว ปิดหน้าต่างนี้ได้เลย");
        setTimeout(() => {
          if (liffObj && liffObj.isInClient && liffObj.isInClient()) liffObj.closeWindow();
        }, 2000);
      } else {
        setErrorMsg("เกิดข้อผิดพลาด: " + (result.error || "ไม่ทราบสาเหตุ"));
      }
    } catch (error) {
      setErrorMsg("เกิดข้อผิดพลาด: " + error.message);
    }
    setLoading(false);
  };

  if (liffError) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{liffError}</div>
      </div>
    );
  }

  if (!ready) {
    return <div className="p-6 text-slate-500 text-sm">กำลังเปิดฟอร์ม...</div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <header className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">🚨 เปิดเหตุฉุกเฉิน</h1>
        <p className="text-xs text-slate-500">ผู้ใหญ่บ้าน — รับแจ้งเหตุและคัดกรองเบื้องต้น</p>
      </header>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      {!successMsg && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">ประเภทเหตุการณ์</label>
            <div className="grid grid-cols-2 gap-2">
              {incidentTypes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleTypeChange(item)}
                  className={`p-2 text-left border rounded-xl text-xs font-medium transition-all ${
                    selectedType === item.id
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">รายละเอียดเคส</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ระดับความรุนแรง</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="RED">🔴 วิกฤต (RED)</option>
              <option value="ORANGE">🟠 เร่งด่วน (ORANGE)</option>
              <option value="YELLOW">🟡 ติดตาม (YELLOW)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">หมู่บ้าน (พิมพ์เพิ่มเติมได้)</label>
            <input
              type="text"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="เช่น หมู่ 3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleAttachLocation}
              disabled={locating}
              className={`w-full py-2 rounded-lg text-sm font-bold border transition ${
                location ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-300 text-slate-700"
              }`}
            >
              {locating ? "กำลังดึงตำแหน่ง..." : location ? "✓ แนบตำแหน่งแล้ว (กดซ้ำเพื่ออัปเดต)" : "📍 แนบตำแหน่งปัจจุบัน"}
            </button>
            {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-bold rounded-xl text-sm disabled:bg-red-300"
          >
            {loading ? "กำลังส่งข้อมูล..." : "+ เปิดเหตุฉุกเฉิน"}
          </button>
        </form>
      )}
    </div>
  );
}

// app/incidents/page.jsx
"use client";

import { useState } from "react";
import { createIncident } from "@/services/incidentService";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/firebase/useRequireAuth";

const incidentTypes = [
  { id: "SUICIDE_RISK", label: "เสี่ยงฆ่าตัวตาย", defaultTitle: "ผู้มีภาวะเสี่ยงฆ่าตัวตาย" },
  { id: "CRAZED", label: "คลุ้มคลั่ง", defaultTitle: "ผู้ป่วยคลุ้มคลั่งอาละวาด" },
  { id: "DRUGS", label: "ยาเสพติด", defaultTitle: "ปัญหาเกี่ยวกับยาเสพติด" },
  { id: "MISSING_MEDS", label: "ขาดยา", defaultTitle: "ผู้ป่วยจิตเวชขาดยา" },
  { id: "RELAPSE", label: "อาการกำเริบ", defaultTitle: "อาการทางจิตเวชกำเริบ" },
];

// ฟอร์มนี้ตั้งใจให้เรียงลำดับฟิลด์เหมือนกับฟอร์ม LIFF (app/liff/report) ทุกประการ
// ประเภท -> ชื่อผู้ป่วย -> รายละเอียด -> ระดับ -> หมู่บ้าน -> แนบตำแหน่ง -> ส่ง
export default function IncidentsPage() {
  const user = useRequireAuth();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("SUICIDE_RISK");
  const [patientName, setPatientName] = useState("");
  const [title, setTitle] = useState("ผู้มีภาวะเสี่ยงฆ่าตัวตาย");
  const [level, setLevel] = useState("RED");
  const [village, setVillage] = useState("หมู่ 3");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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

    const result = await createIncident({
      type: selectedType,
      patientName,
      title,
      level,
      village,
      location,
      createdBy: "ผู้ใหญ่บ้าน",
    });

    if (result.success) {
      setSuccessMsg("เปิดเหตุสำเร็จ! กำลังไปหน้ารายละเอียดเพื่อยืนยันขั้นตอนแรก...");
      setTimeout(() => {
        router.push(`/incidents/${result.docId}`);
      }, 1500);
    } else {
      setErrorMsg(`เกิดข้อผิดพลาด: ${result.error}`);
    }
    setLoading(false);
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">ระบบเปิดเหตุฉุกเฉิน</h1>
      </header>

      {successMsg && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">เลือกประเภทเหตุการณ์</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {incidentTypes.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleTypeChange(item)}
                className={`p-3 text-left border rounded-xl text-sm font-medium transition-all ${
                  selectedType === item.id
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                ☑ {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อผู้ป่วย</label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="เช่น นาย ก. (หรือไม่ระบุก็ได้)"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">หัวข้อ/รายละเอียดเคส</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ระดับความรุนแรง</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="RED">🔴 วิกฤต (RED)</option>
              <option value="ORANGE">🟠 เร่งด่วน (ORANGE)</option>
              <option value="YELLOW">🟡 ติดตาม (YELLOW)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">พื้นที่ / หมู่บ้าน</label>
            <input
              type="text"
              required
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleAttachLocation}
            disabled={locating}
            className={`w-full py-2.5 rounded-lg text-sm font-bold border transition ${
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
          className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition duration-200 shadow-md disabled:bg-red-300"
        >
          {loading ? "กำลังส่งข้อมูล..." : "+ เปิดเหตุฉุกเฉิน"}
        </button>
      </form>
    </div>
  );
}

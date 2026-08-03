// app/incidents/page.jsx
"use client";

import { useState } from "react";
import { createIncident } from "@/services/incidentService";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/firebase/useRequireAuth";
import { useUserRole } from "@/firebase/useUserRole";
import IncidentReportForm from "@/components/IncidentReportForm";

// ฟอร์มนี้ใช้ component เดียวกับฟอร์ม LIFF (app/liff/report) ทุกประการ (components/IncidentReportForm)
// เพื่อให้หน้าตาและลำดับฟิลด์ตรงกันเสมอไม่ว่าจะเปิดจากช่องทางไหน
export default function IncidentsPage() {
  const user = useRequireAuth();
  const role = useUserRole(user);
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("SUICIDE_RISK");
  const [patientName, setPatientName] = useState("");
  const [psychHistory, setPsychHistory] = useState("UNKNOWN");
  const [title, setTitle] = useState("ผู้มีภาวะเสี่ยงฆ่าตัวตาย");
  const [level, setLevel] = useState("RED");
  const [village, setVillage] = useState("หมู่ 3");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fieldSetters = { patientName: setPatientName, psychHistory: setPsychHistory, title: setTitle, level: setLevel, village: setVillage };
  const handleFieldChange = (field, value) => fieldSetters[field]?.(value);

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
      psychHistory,
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
  if (role === undefined) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (role !== "VILLAGE_HEAD" && role !== "ADMIN") {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          หน้านี้จำกัดให้เฉพาะผู้ใหญ่บ้านและผู้ดูแลระบบ (Admin) เท่านั้นที่เปิดเหตุฉุกเฉินได้
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md md:max-w-2xl mx-auto">
      <header className="mb-5 text-center">
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">🚨 เปิดเหตุฉุกเฉิน</h1>
        <p className="text-xs text-slate-500 mt-1">รับแจ้งเหตุและคัดกรองเบื้องต้น — กรอกให้ครบเพื่อแจ้งเตือนหน่วยที่เกี่ยวข้องทันที</p>
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

      <IncidentReportForm
        values={{ type: selectedType, patientName, psychHistory, title, level, village, location }}
        onTypeChange={handleTypeChange}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
        loading={loading}
        locating={locating}
        locationError={locationError}
        onAttachLocation={handleAttachLocation}
        villageRequired
      />
    </div>
  );
}

// app/liff/report/page.jsx
"use client";

import { useState, useEffect } from "react";
import IncidentReportForm from "@/components/IncidentReportForm";

// ฟอร์มนี้ใช้ component เดียวกับหน้าเว็บ (app/incidents) ทุกประการ (components/IncidentReportForm)
// เพื่อให้หน้าตาและลำดับฟิลด์ตรงกันเสมอไม่ว่าจะเปิดจากช่องทางไหน
export default function LiffReportPage() {
  const [liffObj, setLiffObj] = useState(null);
  const [liffError, setLiffError] = useState("");
  const [ready, setReady] = useState(false);

  const [selectedType, setSelectedType] = useState("SUICIDE_RISK");
  const [patientName, setPatientName] = useState("");
  const [psychHistory, setPsychHistory] = useState("UNKNOWN");
  const [title, setTitle] = useState("ผู้มีภาวะเสี่ยงฆ่าตัวตาย");
  const [level, setLevel] = useState("RED");
  const [village, setVillage] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fieldSetters = { patientName: setPatientName, psychHistory: setPsychHistory, title: setTitle, level: setLevel, village: setVillage };
  const handleFieldChange = (field, value) => fieldSetters[field]?.(value);

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
      let accessToken = null;
      if (liffObj) {
        try {
          profile = await liffObj.getProfile();
        } catch {
          // เปิดนอกแอป LINE หรือดึงโปรไฟล์ไม่ได้ ใช้ค่า default แทน
        }
        context = liffObj.getContext ? liffObj.getContext() : null;
        accessToken = liffObj.getAccessToken ? liffObj.getAccessToken() : null;
      }

      const res = await fetch("/api/liff-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          type: selectedType,
          patientName,
          psychHistory,
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
    <div className="p-4 sm:p-6 max-w-md md:max-w-2xl mx-auto">
      <header className="mb-5 text-center">
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">🚨 เปิดเหตุฉุกเฉิน</h1>
        <p className="text-xs text-slate-500 mt-1">ผู้ใหญ่บ้าน — รับแจ้งเหตุและคัดกรองเบื้องต้น</p>
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
        <IncidentReportForm
          values={{ type: selectedType, patientName, psychHistory, title, level, village, location }}
          onTypeChange={handleTypeChange}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          loading={loading}
          locating={locating}
          locationError={locationError}
          onAttachLocation={handleAttachLocation}
          villageRequired={false}
        />
      )}
    </div>
  );
}

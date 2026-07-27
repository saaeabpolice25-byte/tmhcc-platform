// app/units/page.jsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/firebase/config";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { ensureUnitsSeeded, updateUnitLineGroup } from "@/services/unitService";
import { useRequireAuth } from "@/firebase/useRequireAuth";

export default function UnitsPage() {
  const user = useRequireAuth();
  const [isAdmin, setIsAdmin] = useState(null); // null = กำลังตรวจสอบ
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState(null);
  const [sendingButtonCode, setSendingButtonCode] = useState(null);

  // เฉพาะบัญชี role=ADMIN เท่านั้นที่เข้าหน้านี้ได้ (ควบคุมว่าแจ้งเตือนฉุกเฉินจะถูกส่งไปที่กลุ่มไหน)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setIsAdmin(snap.exists() && snap.data().role === "ADMIN");
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      }
    })();
  }, [user]);

  // ensureUnitsSeeded รันครั้งเดียวตอนเข้าเพื่อสร้าง 6 หน่วยเริ่มต้นถ้ายังไม่มี จากนั้นฟัง onSnapshot
  // ต่อเนื่อง ให้เห็น Group ID ที่คนอื่นกรอกจากเครื่องอื่นอัปเดตสดโดยไม่ต้อง refresh
  useEffect(() => {
    if (!isAdmin) return;
    let unsubscribe;
    (async () => {
      await ensureUnitsSeeded();
      unsubscribe = onSnapshot(
        collection(db, "units"),
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (a.stepOrder ?? 999) - (b.stepOrder ?? 999));
          setUnits(list);
          setLoading(false);
        },
        (error) => {
          console.error("Error watching units:", error);
          setLoading(false);
        }
      );
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAdmin]);

  const handleSave = async (unitCode, lineGroupId, active) => {
    setSavingCode(unitCode);
    const actor = localStorage.getItem("userName") || "ไม่ระบุชื่อ";
    await updateUnitLineGroup(unitCode, { lineGroupId, active }, actor);
    setSavingCode(null);
  };

  const handleSendLiffButton = async (unitCode) => {
    setSendingButtonCode(unitCode);
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch("/api/send-liff-button", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, unitCode }),
    });
    const result = await res.json().catch(() => ({}));
    setSendingButtonCode(null);
    if (result.success) {
      alert("ส่งปุ่มเข้ากลุ่มแล้ว — อย่าลืมให้คนในกลุ่มกดค้างที่ข้อความแล้วปักหมุดไว้");
    } else {
      alert("ส่งไม่สำเร็จ: " + result.error);
    }
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (isAdmin === null) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>;
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          หน้านี้จำกัดให้เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="mb-6 sm:mb-8 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">🔗 ตั้งค่ากลุ่ม LINE ต่อหน่วยงาน</h1>
          <p className="text-sm text-slate-500">
            นำ LINE OA เข้ากลุ่มของแต่ละหน่วยงานก่อน แล้วนำ Group ID มาใส่ที่นี่
            เพื่อให้ระบบส่งแจ้งเตือนไปยังกลุ่มที่ถูกต้อง (ยังไม่กรอกได้ ระบบจะข้ามการแจ้งเตือนหน่วยที่ยังไม่มี Group ID)
          </p>
        </header>

        {loading ? (
          <div className="p-6 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="space-y-3">
            {units.map((u) => (
              <UnitRow
                key={u.id}
                unit={u}
                onSave={handleSave}
                saving={savingCode === u.id}
                onSendLiffButton={handleSendLiffButton}
                sendingButton={sendingButtonCode === u.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitRow({ unit, onSave, saving, onSendLiffButton, sendingButton }) {
  const [groupId, setGroupId] = useState(unit.lineGroupId || "");
  const [active, setActive] = useState(unit.active !== false);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="sm:w-40 shrink-0">
        <p className="font-bold text-slate-800">{unit.unitLabel}</p>
        {unit.isConditional && <span className="text-xs text-amber-600">เฉพาะกรณีจำเป็น</span>}
      </div>
      <input
        type="text"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        placeholder="LINE Group ID (เช่น Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)"
        className="flex-1 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
      />
      <label className="flex items-center gap-2 text-sm text-slate-600 shrink-0">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        เปิดใช้งาน
      </label>
      <button
        onClick={() => onSave(unit.id, groupId.trim(), active)}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:bg-blue-300 shrink-0"
      >
        {saving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
      {unit.id === "VILLAGE_HEAD" && (
        <button
          onClick={() => onSendLiffButton(unit.id)}
          disabled={sendingButton || !unit.lineGroupId}
          title={!unit.lineGroupId ? "ต้องบันทึก Group ID ก่อน" : "ส่งปุ่มเปิดเหตุฉุกเฉินเข้ากลุ่มนี้"}
          className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:bg-red-300 shrink-0"
        >
          {sendingButton ? "กำลังส่ง..." : "🚨 ส่งปุ่มเปิดเหตุเข้ากลุ่ม"}
        </button>
      )}
    </div>
  );
}

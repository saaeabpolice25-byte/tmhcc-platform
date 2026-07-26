// app/units/page.jsx
"use client";

import { useState, useEffect } from "react";
import { getUnits, updateUnitLineGroup } from "@/services/unitService";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState(null);

  const fetchUnits = async () => {
    setLoading(true);
    const list = await getUnits();
    setUnits(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleSave = async (unitCode, lineGroupId, active) => {
    setSavingCode(unitCode);
    const actor = localStorage.getItem("userName") || "ไม่ระบุชื่อ";
    await updateUnitLineGroup(unitCode, { lineGroupId, active }, actor);
    await fetchUnits();
    setSavingCode(null);
  };

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
              <UnitRow key={u.id} unit={u} onSave={handleSave} saving={savingCode === u.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitRow({ unit, onSave, saving }) {
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
    </div>
  );
}

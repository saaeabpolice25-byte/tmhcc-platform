// components/IncidentReportForm.jsx
// ฟอร์มเปิดเหตุฉุกเฉิน ใช้ร่วมกันทั้งหน้าเว็บ (app/incidents/page.jsx) และฟอร์ม LIFF ในกลุ่มไลน์
// (app/liff/report/page.jsx) เพื่อให้หน้าตาและลำดับฟิลด์ตรงกันเสมอ ไม่ต้องคอยแก้ 2 ที่ให้ตรงกันเอง
"use client";

export const INCIDENT_TYPES = [
  { id: "SUICIDE_RISK", label: "เสี่ยงฆ่าตัวตาย", defaultTitle: "ผู้มีภาวะเสี่ยงฆ่าตัวตาย" },
  { id: "CRAZED", label: "คลุ้มคลั่ง", defaultTitle: "ผู้ป่วยคลุ้มคลั่งอาละวาด" },
  { id: "DRUGS", label: "ยาเสพติด", defaultTitle: "ปัญหาเกี่ยวกับยาเสพติด" },
  { id: "MISSING_MEDS", label: "ขาดยา", defaultTitle: "ผู้ป่วยจิตเวชขาดยา" },
  { id: "RELAPSE", label: "อาการกำเริบ", defaultTitle: "อาการทางจิตเวชกำเริบ" },
];

export const PSYCH_HISTORY_OPTIONS = [
  { id: "HAS_HISTORY", label: "มีประวัติการรักษาทางจิตเวช" },
  { id: "NO_HISTORY", label: "ไม่มีประวัติการรักษาทางจิตเวช" },
  { id: "UNKNOWN", label: "ไม่ทราบ" },
];

export const LEVEL_OPTIONS = [
  { id: "RED", label: "วิกฤต", emoji: "🔴", active: "border-red-600 bg-red-50 text-red-700 shadow-sm" },
  { id: "ORANGE", label: "เร่งด่วน", emoji: "🟠", active: "border-orange-600 bg-orange-50 text-orange-700 shadow-sm" },
  { id: "YELLOW", label: "ติดตามอาการ", emoji: "🟡", active: "border-yellow-600 bg-yellow-50 text-yellow-700 shadow-sm" },
];

const FIELD_LABEL = "block text-sm font-semibold text-slate-700 mb-2";
const TEXT_INPUT = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";

// ปุ่มตัวเลือกแบบการ์ด ใช้ร่วมกันทั้งประเภทเหตุการณ์/ประวัติจิตเวช/ระดับความรุนแรง
// โชว์เครื่องหมาย ✓ เฉพาะตัวที่ถูกเลือกอยู่ตัวเดียว ไม่ใช่ขึ้นค้างทุกปุ่ม กันสับสนว่าเลือกอันไหนอยู่
function ChoiceButton({ selected, onClick, children, activeClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-3 text-left border-2 rounded-xl text-sm font-medium transition-all ${
        selected
          ? activeClass || "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      {children}
      {selected && <span className="absolute top-2 right-2.5 text-current font-bold">✓</span>}
    </button>
  );
}

export default function IncidentReportForm({
  values,
  onTypeChange,
  onFieldChange,
  onSubmit,
  loading,
  locating,
  locationError,
  onAttachLocation,
  villageRequired = true,
}) {
  const { type, patientName, psychHistory, title, level, village, location } = values;

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-5 md:items-start"
    >
      <div className="md:col-span-2">
        <label className={FIELD_LABEL}>ประเภทเหตุการณ์</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {INCIDENT_TYPES.map((item) => (
            <ChoiceButton key={item.id} selected={type === item.id} onClick={() => onTypeChange(item)}>
              {item.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <label className={FIELD_LABEL}>ชื่อผู้ป่วย</label>
        <input
          type="text"
          value={patientName}
          onChange={(e) => onFieldChange("patientName", e.target.value)}
          placeholder="เช่น นาย ก. (หรือไม่ระบุก็ได้)"
          className={TEXT_INPUT}
        />
      </div>

      <div>
        <label className={FIELD_LABEL}>หัวข้อ/รายละเอียดเคส</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          className={TEXT_INPUT}
        />
      </div>

      <div className="md:col-span-2">
        <label className={FIELD_LABEL}>ประวัติการรักษาทางจิตเวช</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PSYCH_HISTORY_OPTIONS.map((item) => (
            <ChoiceButton key={item.id} selected={psychHistory === item.id} onClick={() => onFieldChange("psychHistory", item.id)}>
              {item.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <label className={FIELD_LABEL}>ระดับความรุนแรง</label>
        <div className="grid grid-cols-3 gap-2.5">
          {LEVEL_OPTIONS.map((item) => (
            <ChoiceButton key={item.id} selected={level === item.id} onClick={() => onFieldChange("level", item.id)} activeClass={item.active}>
              <span className="block text-center">
                <span className="block text-lg leading-none mb-1">{item.emoji}</span>
                {item.label}
              </span>
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <label className={FIELD_LABEL}>พื้นที่ / หมู่บ้าน</label>
        <input
          type="text"
          required={villageRequired}
          value={village}
          onChange={(e) => onFieldChange("village", e.target.value)}
          placeholder="เช่น หมู่ 3"
          className={TEXT_INPUT}
        />
      </div>

      <div>
        <label className={`${FIELD_LABEL} hidden md:block md:invisible`}>ตำแหน่ง</label>
        <button
          type="button"
          onClick={onAttachLocation}
          disabled={locating}
          className={`w-full py-2.5 rounded-xl text-sm font-bold border transition ${
            location ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100"
          }`}
        >
          {locating ? "กำลังดึงตำแหน่ง..." : location ? "✓ แนบตำแหน่งแล้ว (กดซ้ำเพื่ออัปเดต)" : "📍 แนบตำแหน่งปัจจุบัน"}
        </button>
        {locationError && <p className="text-xs text-red-600 mt-1.5">{locationError}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="md:col-span-2 w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-md disabled:bg-red-300"
      >
        {loading ? "กำลังส่งข้อมูล..." : "🚨 เปิดเหตุฉุกเฉิน"}
      </button>
    </form>
  );
}

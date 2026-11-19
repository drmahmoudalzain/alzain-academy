// قراءة كشف الدفعة: العمود الأول اسم الطالب، والثاني المسار/النوع (اختياري)،
// والثالث المستوى (اختياري). لا تُقرأ الأعمدة الأخرى، ولا يُخزَّن الملف بعد المعالجة.
import path from "node:path";
import ExcelJS from "exceljs";

const HEADER_ROW = /^(الاسم|اسم الطالب|الاسم الرباعي|الأسماء|name|student name|full name)$/i;
const HEADER_EXTRA = /^(المسار|القسم|النوع|الجنس|المستوى|track|type|gender|level|section)$/i;

function clean(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("");
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    return "";
  }
  return String(value);
}

function tidy(value) {
  return clean(value).replace(/\s+/g, " ").trim();
}

function fromCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return text
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split(/[,;\t]/);
      return {
        name: tidy(cells[0]).replace(/^["']|["']$/g, ""),
        trackRaw: tidy(cells[1]).replace(/^["']|["']$/g, ""),
        levelRaw: tidy(cells[2]).replace(/^["']|["']$/g, ""),
      };
    })
    .filter((row) => row.name && !HEADER_ROW.test(row.name) && !HEADER_EXTRA.test(row.trackRaw));
}

/** يُرجع صفوف الدفعة { name, trackRaw, levelRaw } من أول ثلاثة أعمدة. */
export async function extractRosterFromFile(file) {
  if (!file?.buffer) throw new Error("لم يُرفق أي ملف.");

  const extension = path.extname(file.originalname ?? "").toLowerCase();
  if (extension === ".csv") return fromCsv(file.buffer);

  if (![".xlsx", ".xlsm"].includes(extension)) {
    throw new Error("صيغة الملف غير مدعومة — استخدم xlsx أو xlsm أو csv.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const entry = {
      name: tidy(row.getCell(1).value),
      trackRaw: tidy(row.getCell(2).value),
      levelRaw: tidy(row.getCell(3).value),
    };
    if (!entry.name) return;
    // صف العنوان يُتجاهل سواء كان في العمود الأول أو الثاني.
    if (rowNumber === 1 && (HEADER_ROW.test(entry.name) || HEADER_EXTRA.test(entry.trackRaw))) return;
    rows.push(entry);
  });
  return rows;
}

/** توافق مع الاستخدام السابق: أسماء العمود الأول فقط. */
export async function extractNamesFromFile(file) {
  return (await extractRosterFromFile(file)).map((row) => row.name);
}

// قراءة عمود الأسماء فقط من ملف دفعة (xlsx / xlsm / csv).
// لا تُقرأ الأعمدة الأخرى، ولا يُخزَّن الملف بعد المعالجة.
import path from "node:path";
import ExcelJS from "exceljs";

const HEADER_ROW = /^(الاسم|اسم الطالب|الاسم الرباعي|الأسماء|name|student name|full name)$/i;

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

function fromCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return text
    .split(/\r?\n/)
    .map((line) => {
      const first = line.split(/[,;\t]/)[0] ?? "";
      return first.replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
    })
    .filter((name) => name && !HEADER_ROW.test(name));
}

/** يُرجع مصفوفة أسماء الطلاب من العمود الأول للملف. */
export async function extractNamesFromFile(file) {
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

  const names = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const name = clean(row.getCell(1).value).replace(/\s+/g, " ").trim();
    if (name && !HEADER_ROW.test(name)) names.push(name);
  });
  return names;
}

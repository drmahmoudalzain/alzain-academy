// تصدير بيانات الطلاب: Excel / Word / PDF (طباعة) / CSV.
// يعمل لطالب واحد أو عدة طلاب عبر كل المسارات، ويعتمد على نطاق الرؤية الذي يحدده المسار المستدعي.
import ExcelJS from "exceljs";
import { db } from "./supabase.js";
import { getSubjectGradesBulk } from "./student-data.js";
import { getProfile } from "./tracks.js";

const SUMMARY_HEADERS = [
  "#",
  "الاسم",
  "الرمز",
  "الرقم الجامعي",
  "القسم",
  "النظام",
  "المستوى",
  "الجنس",
  "الحالة",
  "البريد",
  "الجوال",
  "المقررات",
  "متوسط الدرجات",
  "نسبة الحضور",
  "النقاط",
];

const GRADE_HEADERS = [
  "الرمز",
  "الاسم",
  "المقرر",
  "رمز المقرر",
  "الحضور",
  "التفاعل",
  "الاختبارات",
  "الواجبات",
  "المجموع",
  "التقدير",
];

export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function excelCell(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function round1(value) {
  return Math.round(Number(value ?? 0) * 10) / 10;
}

/** يجهّز صفوف التصدير من قائمة طلاب عابرة لكل المسارات. */
export async function buildStudentExport(students) {
  const rows = Array.isArray(students) ? students : [];
  const ids = rows.map((student) => Number(student.id)).filter(Number.isInteger);
  const generatedAt = new Date().toLocaleString("ar", { numberingSystem: "latn" });

  if (!ids.length) {
    return { generatedAt, summary: [], grades: [] };
  }

  const [enrollRes, pointsRes] = await Promise.all([
    db
      .from("enrollments")
      .select("student_id, status, courses(id, title, code, parent_course_id, archived)")
      .in("student_id", ids)
      .eq("status", "active"),
    db.from("points_ledger").select("user_id, points").in("user_id", ids),
  ]);
  if (enrollRes.error) throw enrollRes.error;
  if (pointsRes.error) throw pointsRes.error;

  const coursesByStudent = new Map(ids.map((id) => [id, []]));
  for (const row of enrollRes.data ?? []) {
    if (!row.courses || row.courses.archived) continue;
    coursesByStudent.get(Number(row.student_id))?.push(row.courses);
  }

  const pointsByStudent = new Map();
  for (const row of pointsRes.data ?? []) {
    const key = Number(row.user_id);
    pointsByStudent.set(key, (pointsByStudent.get(key) ?? 0) + Number(row.points ?? 0));
  }

  const gradesByStudent = await getSubjectGradesBulk(
    rows.map((student) => ({ studentId: Number(student.id), courses: coursesByStudent.get(Number(student.id)) ?? [] }))
  );

  const summary = [];
  const grades = [];

  rows.forEach((student, index) => {
    const id = Number(student.id);
    const studentGrades = gradesByStudent.get(id) ?? [];
    const attended = studentGrades.reduce((sum, grade) => sum + Number(grade.attendance.attended ?? 0), 0);
    const totalLectures = studentGrades.reduce((sum, grade) => sum + Number(grade.attendance.total ?? 0), 0);
    const average = studentGrades.length
      ? Math.round(studentGrades.reduce((sum, grade) => sum + Number(grade.percent ?? 0), 0) / studentGrades.length)
      : 0;
    const profile = getProfile(student.track);

    summary.push({
      "#": index + 1,
      الاسم: student.name ?? "—",
      الرمز: student.platform_id ?? student.university_id ?? "—",
      "الرقم الجامعي": student.university_id ?? "—",
      القسم: profile.label,
      النظام: profile.systemLabel,
      المستوى: student.level ?? "—",
      الجنس: student.gender === "M" ? "ذكر" : student.gender === "F" ? "أنثى" : "—",
      الحالة: student.is_active ? "نشط" : "موقوف",
      البريد: student.email ?? "—",
      الجوال: student.phone ?? "—",
      المقررات: studentGrades.length,
      "متوسط الدرجات": `${average}%`,
      "نسبة الحضور": `${totalLectures ? Math.round((attended / totalLectures) * 100) : 0}%`,
      النقاط: pointsByStudent.get(id) ?? 0,
    });

    for (const grade of studentGrades) {
      grades.push({
        الرمز: student.platform_id ?? student.university_id ?? "—",
        الاسم: student.name ?? "—",
        المقرر: grade.course?.title ?? "—",
        "رمز المقرر": grade.course?.code ?? "—",
        الحضور: `${grade.attendance.earned} / ${grade.attendance.weight}`,
        التفاعل: `${grade.interaction.earned} / ${grade.interaction.weight}`,
        الاختبارات: `${grade.exams.earned} / ${grade.exams.weight}`,
        الواجبات: `${grade.assignments.earned} / ${grade.assignments.weight}`,
        المجموع: `${grade.total} / ${grade.max}`,
        التقدير: grade.letter ?? "—",
      });
    }
  });

  return { generatedAt, summary, grades };
}

function csvText(data) {
  const lines = ["\uFEFF\"تصدير بيانات الطلاب — أكاديمية آل الزين\"", `"تاريخ الإصدار","${data.generatedAt}"`, "", "الطلاب"];
  lines.push(SUMMARY_HEADERS.map(csvCell).join(","));
  for (const row of data.summary) lines.push(SUMMARY_HEADERS.map((key) => csvCell(row[key])).join(","));
  lines.push("", "الدرجات");
  lines.push(GRADE_HEADERS.map(csvCell).join(","));
  for (const row of data.grades) lines.push(GRADE_HEADERS.map((key) => csvCell(row[key])).join(","));
  return lines.join("\n");
}

async function xlsxBuffer(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "أكاديمية آل الزين";
  workbook.created = new Date();

  const addSheet = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true }] });
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(headers.map((key) => excelCell(row[key])));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "right", vertical: "middle" };
    headers.forEach((header, index) => {
      sheet.getColumn(index + 1).width = Math.max(12, Math.min(34, header.length + 8));
    });
    return sheet;
  };

  addSheet("الطلاب", SUMMARY_HEADERS, data.summary);
  addSheet("الدرجات", GRADE_HEADERS, data.grades);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function htmlTable(headers, rows) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${headers.map((key) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="empty">لا توجد بيانات.</td></tr>`}</tbody></table>`;
}

export function exportHtml(data, { printButton = false } = {}) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تصدير بيانات الطلاب — أكاديمية آل الزين</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; color: #18243a; margin: 28px; line-height: 1.6; }
  h1 { font-size: 1.35rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 26px 0 8px; }
  .meta { color: #64748b; font-size: 0.82rem; margin-bottom: 18px; }
  .btn { display: inline-block; padding: 8px 16px; border: 1px solid #1b4a7a; border-radius: 8px; color: #1b4a7a; text-decoration: none; font-weight: bold; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 20px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
  th { background: #eef2f7; }
  tr:nth-child(even) td { background: #fafbfd; }
  .empty { text-align: center; color: #64748b; }
  @media print { .btn { display: none; } body { margin: 12mm; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  ${printButton ? '<a class="btn" href="javascript:window.print()">طباعة / حفظ PDF</a>' : ""}
  <h1>أكاديمية آل الزين — تصدير بيانات الطلاب</h1>
  <div class="meta">تاريخ الإصدار: ${escapeHtml(data.generatedAt)} · عدد الطلاب: ${data.summary.length}</div>
  <h2>الطلاب</h2>
  ${htmlTable(SUMMARY_HEADERS, data.summary)}
  <h2>الدرجات</h2>
  ${htmlTable(GRADE_HEADERS, data.grades)}
</body>
</html>`;
}

function filename(format) {
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === "xlsx" ? "xlsx" : format === "word" ? "doc" : format === "csv" ? "csv" : "html";
  return `alzain-students-${date}.${ext}`;
}

/** يبني الملف ويرسله مباشرة. صيغة pdf تُرسل صفحة قابلة للطباعة/h PDF من المتصفح. */
export async function sendStudentExport(res, students, format) {
  const data = await buildStudentExport(students);
  const safeFormat = ["xlsx", "csv", "word", "pdf"].includes(format) ? format : "xlsx";

  if (safeFormat === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename(safeFormat)}"`);
    return res.send(await xlsxBuffer(data));
  }

  if (safeFormat === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename(safeFormat)}"`);
    return res.send(csvText(data));
  }

  if (safeFormat === "word") {
    res.setHeader("Content-Type", "application/msword; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename(safeFormat)}"`);
    return res.send(exportHtml(data));
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(exportHtml(data, { printButton: true }));
}

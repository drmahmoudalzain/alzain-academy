import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const LECTURE_TYPE = { direct: "مباشر", online: "أونلاين", recorded: "مسجل" };

boot("student", "لوحة التحكم", async ({ profile }) => {
  const res = await call("student_dashboard");
  if (!res.ok) {
    document.getElementById("content").innerHTML = `<div class="empty">تعذّر تحميل البيانات: ${esc(res.error)}</div>`;
    return;
  }
  const d = res.data;
  const firstName = String(d.user?.name || "").split(" ")[0];
  const assessment = assessmentOf(profile.track);

  const lecturesHtml = (d.lectures || [])
    .map((l) => {
      const d2 = new Date(l.scheduled_at);
      const day = d2.getDate();
      const month = new Intl.DateTimeFormat("ar", { month: "short" }).format(d2);
      return `<a class="lecture-item ${l.attendance_open ? "live" : ""}" href="${p("pages/student/lecture.html")}?id=${l.id}">
        <div class="lecture-date"><span class="day">${day}</span><span class="month">${month}</span></div>
        <div class="lecture-info"><h4>${esc(l.title)}</h4>
          <div class="lecture-sub"><span>${fmtDateTime(l.scheduled_at)}</span><span>${esc(l.course || "")}</span></div></div>
        <span class="lecture-type ${l.lecture_type}">${LECTURE_TYPE[l.lecture_type] || esc(l.lecture_type)}</span>
      </a>`;
    })
    .join("");

  const coursesHtml = (d.courses || [])
    .map((c) => `<div class="course-item">
      <div class="course-icon" style="--course-color:${esc(c.color || "#123A63")};"><span>${esc(String(c.code || "").slice(0, 2))}</span></div>
      <div class="course-info"><h4>${esc(c.title)}</h4><div class="course-meta"><span>${esc(c.code || "")}</span><span>${esc(c.teacher || "")}</span></div></div>
      <div class="course-progress"><span class="progress-label">${c.progress ?? 0}%</span><div class="progress-bar"><span style="width:${c.progress ?? 0}%"></span></div></div>
    </div>`)
    .join("");

  const notifHtml = (d.notifications || [])
    .map((n) => `<div class="notif-item unread">
      <div class="notif-icon gold">${icon("file")}</div>
      <div class="notif-content"><h5>${esc(n.title)}</h5><p>${esc(n.body)}</p><time>${rel(n.created_at)}</time></div>
    </div>`)
    .join("");

  const points = d.points_breakdown || {};

  document.getElementById("content").innerHTML = `
  <section class="welcome-card">
    <div class="welcome-content">
      <div class="welcome-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>يوم دراسي موفق</div>
      <h2>أهلاً بعودتك، <span class="name">${esc(firstName)}</span></h2>
      <p>لديك <strong>${d.today_lectures ?? 0} محاضرات</strong> اليوم، ${assessment === "exam" ? `و<strong>${d.upcoming_exams ?? 0} اختبارات</strong> قادمة.` : `و<strong>${d.pending_assignments ?? 0} واجبات</strong> بانتظار تسليمك.`}</p>
      <div class="welcome-actions">
        ${(d.lectures || []).length ? `<a class="btn btn-gold" href="${p("pages/student/lecture.html")}?id=${d.lectures[0].id}">ابدأ التعلّم ${icon("arrow")}</a>` : ""}
        <a class="btn btn-outline" href="${p("pages/student/lectures.html")}">الجدول الأسبوعي</a>
        <a class="btn btn-outline" href="${p("pages/notifications.html")}">الإشعارات${(d.notifications || []).length ? ` (${d.notifications.length})` : ""}</a>
      </div>
    </div>
    <div class="welcome-illustration" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6v46"/><path d="M20 52h24"/><circle cx="32" cy="10" r="3.2" fill="currentColor" stroke="none"/><path d="M10 18h44"/><path d="M10 18L4 32h12L10 18z"/><path d="M54 18L48 32h12L54 18z"/><path d="M4 32a6 6 0 0 0 12 0"/><path d="M48 32a6 6 0 0 0 12 0"/></svg></div>
  </section>

  <section class="stats-grid">
    <div class="stat-card students"><div class="stat-head"><div class="stat-icon">${icon("courses")}</div><span class="stat-trend">نشط</span></div><div class="stat-label">المقررات المسجلة</div><div class="stat-value">${fmtNum(d.courses_count)} <small>مقررات</small></div></div>
    <div class="stat-card attendance"><div class="stat-head"><div class="stat-icon">${icon("check")}</div></div><div class="stat-label">نسبة الحضور</div><div class="stat-value">${fmtPoints(d.attendance_pct)}<small>%</small></div></div>
    <div class="stat-card points"><div class="stat-head"><div class="stat-icon">${icon("points")}</div></div><div class="stat-label">إجمالي النقاط</div><div class="stat-value">${fmtNum(d.points_total)} <small>نقطة</small></div></div>
    <div class="stat-card exams"><div class="stat-head"><div class="stat-icon">${assessment === "exam" ? icon("clock") : icon("assignments")}</div></div><div class="stat-label">${assessment === "exam" ? "اختبارات قادمة" : "واجبات معلقة"}</div><div class="stat-value">${assessment === "exam" ? (d.upcoming_exams ?? 0) : (d.pending_assignments ?? 0)} <small>${assessment === "exam" ? "اختبارات" : "واجبات"}</small></div></div>
  </section>

  <section class="dashboard-grid">
    <div class="stack">
      <div class="card"><div class="card-header"><div class="card-title">${icon("courses")} مقرراتي النشطة</div><a href="${p("pages/student/grades.html")}" class="card-link">الدرجات ${icon("arrow")}</a></div>
        <div class="card-body">${coursesHtml || `<div class="empty-state"><h3>لا توجد مقررات مسجلة</h3><p>تواصل مع إدارة الأكاديمية لتسجيل مقرراتك.</p></div>`}</div></div>
      <div class="card"><div class="card-header"><div class="card-title">${icon("calendar")} المحاضرات القادمة</div><a href="${p("pages/student/lectures.html")}" class="card-link">الكل ${icon("arrow")}</a></div>
        <div class="card-body no-pad">${lecturesHtml || `<div class="empty-state" style="border:0;"><h3>لا توجد محاضرات قادمة</h3><p>ستظهر هنا المحاضرات المجدولة قريباً.</p></div>`}</div></div>
    </div>

    <div class="stack">
      <div class="points-card"><div class="points-head"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><h3>نقاطي</h3></div>
        <div class="points-value"><span class="num">${fmtNum(d.points_total)}</span><span class="unit">نقطة</span></div>
        <div class="points-breakdown">
          <div class="points-row"><span class="label"><span class="dot att"></span>الحضور</span><strong>${points.attendance ?? 0}</strong></div>
          <div class="points-row"><span class="label"><span class="dot int"></span>التفاعل</span><strong>${points.interaction ?? 0}</strong></div>
          <div class="points-row"><span class="label"><span class="dot asg"></span>الواجبات</span><strong>${points.assignment ?? 0}</strong></div>
        </div>
        <a class="btn btn-outline btn-block mt-0" href="${p("pages/student/points.html")}">سجل النقاط الكامل</a></div>

      <div class="card"><div class="card-header"><div class="card-title">${icon("bell")} الإشعارات</div><a href="${p("pages/notifications.html")}" style="font-size:0.78rem;font-weight:600;color:var(--green);">عرض الكل ←</a></div>
        <div class="card-body no-pad">${notifHtml || `<div class="empty-state" style="border:0;"><p>لا توجد إشعارات جديدة.</p></div>`}</div></div>

      <div class="card"><div class="card-header"><div class="card-title">${icon("assistant")} إجراءات سريعة</div></div>
        <div class="quick-actions">
          ${assessment === "assignment" ? `<a class="action-btn" href="${p("pages/student/assignments.html")}"><div class="icon-wrap">${icon("assignments")}</div><span>تسليم واجب</span></a>` : ""}
          ${assessment === "exam" ? `<a class="action-btn green" href="${p("pages/student/exams.html")}"><div class="icon-wrap">${icon("exams")}</div><span>الاختبارات</span></a>` : ""}
          <a class="action-btn blue" href="${p("pages/student/points.html")}"><div class="icon-wrap">${icon("points")}</div><span>نقاطي</span></a>
          <a class="action-btn" href="${p("pages/account.html")}"><div class="icon-wrap">${icon("user")}</div><span>حسابي</span></a>
        </div></div>
    </div>
  </section>`;
});

function assessmentOf(track) {
  return track && ["bachelor", "bachelor_m", "equiv", "external"].includes(track) ? "exam" : "assignment";
}

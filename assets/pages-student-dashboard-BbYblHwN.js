import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as f,e,f as b,i as t,r as w,a as o,d as y}from"./portal-xyj4PMfy.js";import{c as k}from"./api-DQI-AaeE.js";import{p as i}from"./base-CLcZMpw2.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const _={direct:"مباشر",online:"أونلاين",recorded:"مسجل"};f("student","لوحة التحكم",async({profile:d})=>{var r;const c=await k("student_dashboard");if(!c.ok){document.getElementById("content").innerHTML=`<div class="empty">تعذّر تحميل البيانات: ${e(c.error)}</div>`;return}const a=c.data,p=String(((r=a.user)==null?void 0:r.name)||"").split(" ")[0],n=x(d.track),m=(a.lectures||[]).map(s=>{const v=new Date(s.scheduled_at),$=v.getDate(),g=new Intl.DateTimeFormat("ar",{month:"short"}).format(v);return`<a class="lecture-item ${s.attendance_open?"live":""}" href="${i("pages/student/lecture.html")}?id=${s.id}">
        <div class="lecture-date"><span class="day">${$}</span><span class="month">${g}</span></div>
        <div class="lecture-info"><h4>${e(s.title)}</h4>
          <div class="lecture-sub"><span>${b(s.scheduled_at)}</span><span>${e(s.course||"")}</span></div></div>
        <span class="lecture-type ${s.lecture_type}">${_[s.lecture_type]||e(s.lecture_type)}</span>
      </a>`}).join(""),u=(a.courses||[]).map(s=>`<div class="course-item">
      <div class="course-icon" style="--course-color:${e(s.color||"#123A63")};"><span>${e(String(s.code||"").slice(0,2))}</span></div>
      <div class="course-info"><h4>${e(s.title)}</h4><div class="course-meta"><span>${e(s.code||"")}</span><span>${e(s.teacher||"")}</span></div></div>
      <div class="course-progress"><span class="progress-label">${s.progress??0}%</span><div class="progress-bar"><span style="width:${s.progress??0}%"></span></div></div>
    </div>`).join(""),h=(a.notifications||[]).map(s=>`<div class="notif-item unread">
      <div class="notif-icon gold">${t("file")}</div>
      <div class="notif-content"><h5>${e(s.title)}</h5><p>${e(s.body)}</p><time>${w(s.created_at)}</time></div>
    </div>`).join(""),l=a.points_breakdown||{};document.getElementById("content").innerHTML=`
  <section class="welcome-card">
    <div class="welcome-content">
      <div class="welcome-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>يوم دراسي موفق</div>
      <h2>أهلاً بعودتك، <span class="name">${e(p)}</span></h2>
      <p>لديك <strong>${a.today_lectures??0} محاضرات</strong> اليوم، ${n==="exam"?`و<strong>${a.upcoming_exams??0} اختبارات</strong> قادمة.`:`و<strong>${a.pending_assignments??0} واجبات</strong> بانتظار تسليمك.`}</p>
      <div class="welcome-actions">
        ${(a.lectures||[]).length?`<a class="btn btn-gold" href="${i("pages/student/lecture.html")}?id=${a.lectures[0].id}">ابدأ التعلّم ${t("arrow")}</a>`:""}
        <a class="btn btn-outline" href="${i("pages/student/lectures.html")}">الجدول الأسبوعي</a>
        <a class="btn btn-outline" href="${i("pages/notifications.html")}">الإشعارات${(a.notifications||[]).length?` (${a.notifications.length})`:""}</a>
      </div>
    </div>
    <div class="welcome-illustration" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6v46"/><path d="M20 52h24"/><circle cx="32" cy="10" r="3.2" fill="currentColor" stroke="none"/><path d="M10 18h44"/><path d="M10 18L4 32h12L10 18z"/><path d="M54 18L48 32h12L54 18z"/><path d="M4 32a6 6 0 0 0 12 0"/><path d="M48 32a6 6 0 0 0 12 0"/></svg></div>
  </section>

  <section class="stats-grid">
    <div class="stat-card students"><div class="stat-head"><div class="stat-icon">${t("courses")}</div><span class="stat-trend">نشط</span></div><div class="stat-label">المقررات المسجلة</div><div class="stat-value">${o(a.courses_count)} <small>مقررات</small></div></div>
    <div class="stat-card attendance"><div class="stat-head"><div class="stat-icon">${t("check")}</div></div><div class="stat-label">نسبة الحضور</div><div class="stat-value">${y(a.attendance_pct)}<small>%</small></div></div>
    <div class="stat-card points"><div class="stat-head"><div class="stat-icon">${t("points")}</div></div><div class="stat-label">إجمالي النقاط</div><div class="stat-value">${o(a.points_total)} <small>نقطة</small></div></div>
    <div class="stat-card exams"><div class="stat-head"><div class="stat-icon">${n==="exam"?t("clock"):t("assignments")}</div></div><div class="stat-label">${n==="exam"?"اختبارات قادمة":"واجبات معلقة"}</div><div class="stat-value">${n==="exam"?a.upcoming_exams??0:a.pending_assignments??0} <small>${n==="exam"?"اختبارات":"واجبات"}</small></div></div>
  </section>

  <section class="dashboard-grid">
    <div class="stack">
      <div class="card"><div class="card-header"><div class="card-title">${t("courses")} مقرراتي النشطة</div><a href="${i("pages/student/grades.html")}" class="card-link">الدرجات ${t("arrow")}</a></div>
        <div class="card-body">${u||'<div class="empty-state"><h3>لا توجد مقررات مسجلة</h3><p>تواصل مع إدارة الأكاديمية لتسجيل مقرراتك.</p></div>'}</div></div>
      <div class="card"><div class="card-header"><div class="card-title">${t("calendar")} المحاضرات القادمة</div><a href="${i("pages/student/lectures.html")}" class="card-link">الكل ${t("arrow")}</a></div>
        <div class="card-body no-pad">${m||'<div class="empty-state" style="border:0;"><h3>لا توجد محاضرات قادمة</h3><p>ستظهر هنا المحاضرات المجدولة قريباً.</p></div>'}</div></div>
    </div>

    <div class="stack">
      <div class="points-card"><div class="points-head"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><h3>نقاطي</h3></div>
        <div class="points-value"><span class="num">${o(a.points_total)}</span><span class="unit">نقطة</span></div>
        <div class="points-breakdown">
          <div class="points-row"><span class="label"><span class="dot att"></span>الحضور</span><strong>${l.attendance??0}</strong></div>
          <div class="points-row"><span class="label"><span class="dot int"></span>التفاعل</span><strong>${l.interaction??0}</strong></div>
          <div class="points-row"><span class="label"><span class="dot asg"></span>الواجبات</span><strong>${l.assignment??0}</strong></div>
        </div>
        <a class="btn btn-outline btn-block mt-0" href="${i("pages/student/points.html")}">سجل النقاط الكامل</a></div>

      <div class="card"><div class="card-header"><div class="card-title">${t("bell")} الإشعارات</div><a href="${i("pages/notifications.html")}" style="font-size:0.78rem;font-weight:600;color:var(--green);">عرض الكل ←</a></div>
        <div class="card-body no-pad">${h||'<div class="empty-state" style="border:0;"><p>لا توجد إشعارات جديدة.</p></div>'}</div></div>

      <div class="card"><div class="card-header"><div class="card-title">${t("assistant")} إجراءات سريعة</div></div>
        <div class="quick-actions">
          ${n==="assignment"?`<a class="action-btn" href="${i("pages/student/assignments.html")}"><div class="icon-wrap">${t("assignments")}</div><span>تسليم واجب</span></a>`:""}
          ${n==="exam"?`<a class="action-btn green" href="${i("pages/student/exams.html")}"><div class="icon-wrap">${t("exams")}</div><span>الاختبارات</span></a>`:""}
          <a class="action-btn blue" href="${i("pages/student/points.html")}"><div class="icon-wrap">${t("points")}</div><span>نقاطي</span></a>
          <a class="action-btn" href="${i("pages/account.html")}"><div class="icon-wrap">${t("user")}</div><span>حسابي</span></a>
        </div></div>
    </div>
  </section>`});function x(d){return d&&["bachelor","bachelor_m","equiv","external"].includes(d)?"exam":"assignment"}

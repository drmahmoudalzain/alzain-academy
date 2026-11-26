import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as g,e,i as m}from"./portal-CxwtNPRX.js";import{e as r}from"./identity-rules-Cp64wFaG.js";import{p}from"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";const f=c=>document.getElementById(c);g({portal:"student",title:"مقرراتي",render:async({profile:c})=>{const i=c==null?void 0:c.id,t=f("scGrid");if(t.innerHTML='<div class="lcs-skeleton lcs-skeleton-card"></div>'.repeat(3),!i){t.innerHTML='<div class="lcs-empty" role="status"><h3>تعذّر تحديد المستخدم</h3></div>';return}const{data:d,error:l}=await r.from("enrollments").select("course_id, status, created_at").eq("student_id",i);if(l){t.innerHTML=`<div class="lcs-empty" role="status"><h3>تعذّر تحميل المقررات</h3><p>${e(l.message||"")}</p></div>`;return}const n=(d||[]).map(s=>s.course_id);if(!n.length){t.innerHTML='<div class="lcs-empty" role="status"><h3>لا توجد مقررات مسجّلة</h3></div>';return}const{data:u,error:o}=await r.from("courses").select("id, title, code, color, track, level, teacher_id, archived").in("id",n);if(o){t.innerHTML=`<div class="lcs-empty" role="status"><h3>تعذّر تحميل المقررات</h3><p>${e(o.message||"")}</p></div>`;return}const{data:h}=await r.from("users").select("id, name").eq("role","teacher"),v=new Map((h||[]).map(s=>[s.id,s.name])),$=new Map((d||[]).map(s=>[s.course_id,s])),M=(u||[]).map(s=>{const a=$.get(s.id);return`<article class="lcs-card">
        <div class="lcs-card-head">
          <span class="lcs-card-code">${e(s.code||"—")}</span>
          <span class="lcs-card-status">${(a==null?void 0:a.status)==="active"?"نشط":(a==null?void 0:a.status)||"—"}</span>
        </div>
        <h3>${e(s.title||"—")}</h3>
        <p class="lcs-card-sub">${e(v.get(s.teacher_id)||"—")} · ${e(s.track||"—")} · مستوى ${s.level||"—"}</p>
        <div class="lcs-card-actions">
          <a class="lcs-btn" href="${e(p("pages/student/lectures.html"))}">${m("lectures")} المحاضرات</a>
          <a class="lcs-btn" href="${e(p("pages/student/exams.html"))}">${m("exams")} الاختبارات</a>
        </div>
      </article>`}).join("");t.innerHTML=M||'<div class="lcs-empty" role="status"><h3>لا توجد مقررات</h3></div>'}});

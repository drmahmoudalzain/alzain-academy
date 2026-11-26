import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as W,i as u,e as l,c as j}from"./portal-CxwtNPRX.js";import{e as v}from"./identity-rules-Cp64wFaG.js";import{p as U}from"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";const b=15,G=10,_={announcement:{label:"إعلان",tab:"الإعلانات",icon:"bell"},course:{label:"مقرر",tab:"المقررات",icon:"book"},exam:{label:"اختبار",tab:"الاختبارات",icon:"exams"},assignment:{label:"واجب",tab:"الواجبات",icon:"assignments"},message:{label:"رسالة",tab:"الرسائل",icon:"forum"},grade:{label:"نتيجة",tab:"النتائج",icon:"grades"},system:{label:"نظام",tab:"النظام",icon:"settings"}},Y=["announcement","course","exam","assignment","message","grade","system"],L=[{id:"today",title:"اليوم",icon:"calendar"},{id:"yesterday",title:"أمس",icon:"clock"},{id:"week",title:"هذا الأسبوع",icon:"calendar"},{id:"older",title:"أقدم",icon:"clock"}],S=o=>new Date(o.getFullYear(),o.getMonth(),o.getDate()).getTime();function D(o){const n=new Date(o);if(Number.isNaN(n.getTime()))return"older";const r=Math.round((S(new Date)-S(n))/864e5);return r<=0?"today":r===1?"yesterday":r<7?"week":"older"}function w(o,n,r,a,d){return o===1?n:o===2?r:o>=3&&o<=10?`${o} ${a}`:`${o} ${d}`}function F(o){const n=new Date(o);if(Number.isNaN(n.getTime()))return"—";const r=Math.floor((Date.now()-n.getTime())/6e4);if(r<1)return"الآن";if(r<60)return`منذ ${w(r,"دقيقة","دقيقتين","دقائق","دقيقة")}`;const a=Math.floor(r/60);if(a<24)return`منذ ${w(a,"ساعة","ساعتين","ساعات","ساعة")}`;const d=Math.floor(a/24);return d<7?`منذ ${w(d,"يوم","يومين","أيام","يوم")}`:j(o)}W({portals:["student","teacher","assistant","owner"],title:"الإشعارات",render:async({profile:o})=>{const n=t=>document.getElementById(t),r={pill:n("unreadPill"),pillCount:n("unreadPillCount"),stats:n("notifStats"),statTotal:n("statTotal"),statUnread:n("statUnread"),statCourses:n("statCourses"),statSystem:n("statSystem"),tabs:n("notifTabs"),time:n("timeFilter"),list:n("notifList"),loadWrap:n("loadMoreWrap"),loadBtn:n("loadMoreBtn"),summary:n("toolbarSummary"),markAll:n("markAllReadBtn"),toolbarMarkRead:n("toolbarMarkRead"),reload:n("reloadBtn"),toasts:n("notifToasts")},a={items:[],filter:"all",time:"all",shown:b,loading:!0,error:null},d=(t,e="info")=>{const s=document.createElement("div");s.className=`notif-toast ${e}`,s.innerHTML=`${u(e==="success"?"check":e==="danger"?"close":"bell")}<span>${l(t)}</span>`,r.toasts.appendChild(s),setTimeout(()=>{s.classList.add("hide"),setTimeout(()=>s.remove(),300)},2600)},H=t=>{const e=String(t||"").trim();return e?/^https?:\/\//i.test(e)?e:/^(pages\/|guide\.html|index\.html|login\.html)/.test(e)?U(e):null:null},g=t=>a.items.filter(t).length,C=()=>{const t=new Map;return a.items.forEach(e=>t.set(e.type,(t.get(e.type)||0)+1)),t},k=()=>{const t=a.items.length,e=g(s=>!s.is_read);r.statTotal.innerHTML=`${t} <small>إشعار</small>`,r.statUnread.innerHTML=`${e} <small>إشعار</small>`,r.statCourses.innerHTML=`${g(s=>s.type==="course")} <small>إشعار</small>`,r.statSystem.innerHTML=`${g(s=>s.type==="system")} <small>إشعار</small>`,r.pill.hidden=e===0,r.pillCount.textContent=String(e),r.summary.innerHTML=e>0?`لديك <strong>${e} ${e===1?"إشعار":"إشعارات"}</strong> غير مقروءة`:"كل الإشعارات مقروءة",r.markAll.disabled=e===0,r.toolbarMarkRead.hidden=e===0},B=()=>{const t=a.items.length,e=g(m=>!m.is_read),s=g(m=>m.is_starred),i=C(),c=[{id:"all",label:"الكل",count:t},{id:"unread",label:"غير مقروءة",count:e,dot:!0}];return s&&c.push({id:"starred",label:"المميّزة",count:s,star:!0}),Y.forEach(m=>{i.get(m)&&c.push({id:m,label:_[m].tab,count:i.get(m)})}),c},h=()=>{const t=B();t.some(e=>e.id===a.filter)||(a.filter="all",a.shown=b),r.tabs.innerHTML=t.map(e=>`<button class="notif-tab${a.filter===e.id?" active":""}" type="button"
                    role="tab" data-filter="${l(e.id)}" aria-selected="${a.filter===e.id}">
            ${e.dot?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/></svg>':""}
            ${e.star?u("star"):""}
            ${l(e.label)}
            <span class="tab-count">${e.count}</span>
          </button>`).join("")},N=t=>{if(a.time==="all")return!0;const e=new Date(t).getTime();return Number.isNaN(e)?!1:a.time==="today"?D(t)==="today":a.time==="week"?Date.now()-e<7*864e5:a.time==="month"?Date.now()-e<30*864e5:!0},x=()=>a.items.filter(t=>a.filter==="unread"&&t.is_read||a.filter==="starred"&&!t.is_starred||a.filter!=="all"&&a.filter!=="unread"&&a.filter!=="starred"&&t.type!==a.filter?!1:N(t.created_at)),R=t=>{const e=_[t.type]||_.system,s=!t.is_read,i=H(t.link);return`<article class="notif-item${s?" unread":""}" data-id="${t.id}" tabindex="0"
                  role="button" aria-label="${l(t.title)}${s?" — غير مقروء":""}">
        <div class="notif-icon ${l(t.type)}">
          ${u(e.icon)}
          ${s?'<span class="unread-dot" aria-hidden="true"></span>':""}
        </div>
        <div class="notif-body">
          <div class="notif-header-row">
            <span class="notif-type-tag ${l(t.type)}">${l(e.label)}</span>
          </div>
          <h3 class="notif-title">${l(t.title)}</h3>
          ${t.body?`<p class="notif-text">${l(t.body)}</p>`:""}
          <div class="notif-footer">
            <span class="notif-time">${u("clock")}${l(F(t.created_at))}</span>
            ${t.creator_name?`<span class="notif-from">${u("user")}من <strong>${l(t.creator_name)}</strong></span>`:""}
            ${t.course_title?`<span class="notif-course">${u("book")}${l(t.course_title)}</span>`:""}
            ${i?`<a class="notif-action-btn" href="${l(i)}" data-open>${u("arrow")}عرض</a>`:""}
          </div>
        </div>
        <div class="notif-item-actions">
          <button class="notif-icon-btn${t.is_starred?" starred":""}" type="button" data-act="star"
                  aria-label="${t.is_starred?"إزالة التمييز":"تمييز الإشعار"}" aria-pressed="${t.is_starred}">
            ${u("star")}
          </button>
          <button class="notif-icon-btn" type="button" data-act="dismiss" aria-label="إخفاء الإشعار">
            ${u("trash")}
          </button>
        </div>
      </article>`},A=()=>a.items.length===0?`<div class="notif-empty">
          <div class="notif-empty-icon">${u("bell")}</div>
          <h3>لا توجد إشعارات بعد</h3>
          <p>ستظهر هنا إشعارات الأكاديمية والمقررات والاختبارات فور صدورها.</p>
        </div>`:`<div class="notif-empty">
        <div class="notif-empty-icon">${u("bell")}</div>
        <h3>لا توجد إشعارات مطابقة</h3>
        <p>لم نجد إشعارات تطابق الفلتر الحالي. جرّب تغيير النوع أو الفترة الزمنية.</p>
        <div class="notif-empty-actions">
          <button class="notif-btn notif-btn-secondary notif-btn-sm" type="button" data-reset>عرض كل الإشعارات</button>
        </div>
      </div>`,P=()=>`<div class="notif-empty">
      <div class="notif-empty-icon">${u("close")}</div>
      <h3>تعذّر تحميل الإشعارات</h3>
      <p>حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.</p>
      <div class="notif-empty-actions">
        <button class="notif-btn notif-btn-secondary notif-btn-sm" type="button" data-retry>إعادة المحاولة</button>
      </div>
    </div>`,p=()=>{if(a.loading){r.list.innerHTML='<div class="notif-skeleton"></div><div class="notif-skeleton"></div><div class="notif-skeleton"></div>',r.loadWrap.hidden=!0;return}if(a.error){r.list.innerHTML=P(),r.loadWrap.hidden=!0;return}const t=x();if(t.length===0){r.list.innerHTML=A(),r.loadWrap.hidden=!0;return}const e=t.slice(0,a.shown),s=new Map(L.map(i=>[i.id,[]]));e.forEach(i=>{var c;return(c=s.get(D(i.created_at)))==null?void 0:c.push(i)}),r.list.innerHTML=L.filter(i=>s.get(i.id).length).map(i=>`<div class="notif-group">
            <div class="notif-group-header">
              <div class="notif-group-title">${u(i.icon)}${l(i.title)}</div>
              <span class="notif-group-count">${s.get(i.id).length} ${s.get(i.id).length===1?"إشعار":"إشعارات"}</span>
            </div>
            ${s.get(i.id).map(R).join("")}
          </div>`).join(""),r.loadWrap.hidden=t.length<=a.shown},f=()=>{k(),h(),p()};async function y({silent:t=!1}={}){t||(a.loading=!0,a.error=null,p(),k());const{data:e,error:s}=await v.rpc("my_notifications");if(a.loading=!1,s){a.error=s,console.error("[notifications]",s),p();return}a.items=(e||[]).map(i=>({...i,is_read:!!i.is_read,is_starred:!!i.is_starred})),a.error=null,a.shown=Math.max(a.shown,b),f()}const $=(t,e)=>v.from("notification_reads").upsert({notification_id:t.id,user_id:o.id,read_at:t.is_read?new Date().toISOString():null,starred:!!t.is_starred,dismissed_at:null,...e},{onConflict:"notification_id,user_id"});async function T(t){if(t.is_read)return;t.is_read=!0,f();const{error:e}=await $(t,{read_at:new Date().toISOString()});e&&(t.is_read=!1,f(),d("تعذّر تحديث حالة القراءة","danger"))}async function M(){const t=a.items.filter(i=>!i.is_read);if(!t.length)return;const e=new Date().toISOString();t.forEach(i=>{i.is_read=!0}),f();const{error:s}=await v.from("notification_reads").upsert(t.map(i=>({notification_id:i.id,user_id:o.id,read_at:e,starred:!!i.is_starred})),{onConflict:"notification_id,user_id"});if(s){t.forEach(i=>{i.is_read=!1}),f(),d("تعذّر تعليم الإشعارات كمقروءة","danger");return}d("تم تعليم كل الإشعارات كمقروءة","success")}async function I(t){const e=!t.is_starred;t.is_starred=e,f();const{error:s}=await $(t,{starred:e});if(s){t.is_starred=!e,f(),d("تعذّر تحديث التمييز","danger");return}d(e?"تم تمييز الإشعار":"تمت إزالة التمييز",e?"success":"warning")}async function O(t){const e={...t};a.items=a.items.filter(i=>i.id!==t.id),f();const{error:s}=await $(t,{dismissed_at:new Date().toISOString()});if(s){a.items.push(e),a.items.sort((i,c)=>new Date(c.created_at)-new Date(i.created_at)),f(),d("تعذّر إخفاء الإشعار","danger");return}d("تم إخفاء الإشعار","warning")}const E=t=>a.items.find(e=>Number(e.id)===Number(t));r.tabs.addEventListener("click",t=>{const e=t.target.closest(".notif-tab");e&&(a.filter=e.dataset.filter,a.shown=b,h(),p())}),r.time.addEventListener("change",t=>{a.time=t.target.value,a.shown=b,p()}),r.stats.addEventListener("click",t=>{const e=t.target.closest("[data-jump]");e&&(a.filter=e.dataset.jump,a.shown=b,h(),p())}),r.list.addEventListener("click",t=>{if(t.target.closest("[data-retry]")){y();return}if(t.target.closest("[data-reset]")){a.filter="all",a.time="all",r.time.value="all",a.shown=b,f();return}const i=t.target.closest(".notif-item");if(!i)return;const c=E(i.dataset.id);if(!c)return;if(t.target.closest('[data-act="star"]'))return I(c);if(t.target.closest('[data-act="dismiss"]'))return O(c);T(c)}),r.list.addEventListener("keydown",t=>{if(t.key!=="Enter"&&t.key!==" ")return;const e=t.target.closest(".notif-item");if(!e||t.target!==e)return;t.preventDefault();const s=E(e.dataset.id);s&&T(s)}),r.markAll.addEventListener("click",M),r.toolbarMarkRead.addEventListener("click",M),r.reload.addEventListener("click",async()=>{r.reload.disabled=!0,await y({silent:!0}),r.reload.disabled=!1,d(a.error?"تعذّر تحديث الإشعارات":"تم تحديث الإشعارات",a.error?"danger":"success")}),r.loadBtn.addEventListener("click",()=>{a.shown+=G,p()}),await y()}});

const i="alzain.firstVisitGuideSeen",c=["portal-student","portal-teacher","portal-assistant","portal-owner"],a="login.html",s="login";function u(t){const e=t.replace(/\/+$/,"");return e===a||e===s||e.endsWith(`/${a}`)||e.endsWith(`/${s}`)}function l(t=""){const e=String(t||"").toLowerCase();return e.includes("/pages/")||u(e)?!1:!/\.html$/.test(e)||/(^|\/)(index|guide)\.html$/.test(e)}function f(t){try{return t?t.getItem(i)==="1":localStorage.getItem(i)==="1"}catch{return!1}}function p(t){try{t||localStorage.setItem(i,"1")}catch{}}const m=`
.fv-first-visit {
  position: fixed;
  z-index: 60;
  inset-block-end: 18px;
  inset-inline-start: 18px;
  max-width: min(360px, calc(100vw - 36px));
  pointer-events: none;
}
.fv-card {
  position: relative;
  pointer-events: auto;
  padding: 18px 42px 18px 20px;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  background: #FFFFFF;
  color: #0B2545;
  box-shadow: 0 16px 40px -12px rgba(11, 37, 69, 0.3);
  font-family: "Tajawal", "Segoe UI", sans-serif;
  font-size: 0.92rem;
  line-height: 1.8;
}
.fv-card h2 { margin: 0 0 8px; font-size: 1.1rem; }
.fv-card p { margin: 0 0 12px; color: #4A5A6F; }
.fv-guide-link {
  display: inline-block;
  padding: 7px 14px;
  border-radius: 8px;
  background: #0B2545;
  color: #FFFFFF;
  font-weight: 700;
  text-decoration: none;
}
.fv-guide-link:hover { background: #123A63; }
.fv-close {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #536579;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}
.fv-close:hover { background: #F1F4F8; }
@media print {
  .fv-first-visit { display: none !important; }
}`;function d(){var r;if(typeof document>"u"||typeof location>"u"||!l(location.pathname)||c.some(n=>document.body.classList.contains(n))||document.getElementById("fvFirstVisit")||f())return null;const t=document.createElement("style");t.textContent=m,document.head.appendChild(t);const e=document.createElement("div");e.id="fvFirstVisit",e.className="fv-first-visit",e.innerHTML=`
    <div class="fv-card" role="dialog" aria-modal="false" aria-labelledby="fvTitle" aria-describedby="fvText">
      <button type="button" class="fv-close" aria-label="إغلاق التنبيه">×</button>
      <h2 id="fvTitle">مرحباً بك في أكاديمية آل الزين</h2>
      <p id="fvText">يمكنك التعرّف على البوابات الأربع وخطوات الدخول ونظام الدرجات من دليل المستخدم، ويبقى متاحاً للطباعة أو الحفظ كملف PDF.</p>
      <a class="fv-guide-link" href="guide.html">افتح دليل المستخدم</a>
    </div>`,document.body.appendChild(e),p();const o=()=>{e.remove(),t.remove()};return(r=e.querySelector(".fv-close"))==null||r.addEventListener("click",o),document.addEventListener("keydown",n=>{n.key==="Escape"&&o()}),e}typeof document<"u"&&typeof location<"u"&&l(location.pathname)&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",d,{once:!0}):d());export{l as a,d as i};

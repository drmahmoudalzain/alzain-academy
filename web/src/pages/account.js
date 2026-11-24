import { boot } from "../lib/portal.js";
import { supabase } from "../lib/supabase.js";
import { call } from "../lib/api.js";
import { currentUser } from "../lib/auth.js";
import { esc, fmtDateTime } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";

const ROLE_LABEL = {
  student: "طالب",
  teacher: "أستاذ",
  assistant: "مساعد إداري",
  owner: "مالك الأكاديمية",
};

const PASSWORD_RULES = [
  { key: "length", test: (v) => v.length >= 8 },
  { key: "upper", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", test: (v) => /[a-z]/.test(v) },
  { key: "number", test: (v) => /[0-9]/.test(v) },
  { key: "special", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

boot({
  portals: ["student", "teacher", "assistant", "owner"],
  title: "حسابي",
  render: async ({ profile }) => {
    const $ = (id) => document.getElementById(id);
    const el = {
      notice: $("passwordNotice"),
      name: $("acctName"),
      role: $("acctRole"),
      email: $("acctEmail"),
      code: $("acctCode"),
      avatar: $("acctAvatar"),
      statCourses: $("statCourses"),
      statUnread: $("statUnread"),
      nav: document.querySelector(".acct-nav"),
      personalForm: $("personalForm"),
      fullName: $("acctFullName"),
      codeInput: $("acctCodeInput"),
      emailInput: $("acctEmailInput"),
      phone: $("acctPhone"),
      levelInput: $("acctLevelInput"),
      resetPersonal: $("resetPersonalBtn"),
      savePersonal: $("savePersonalBtn"),
      passwordForm: $("passwordForm"),
      currentPwd: $("currentPwd"),
      newPwd: $("newPwd"),
      confirmPwd: $("confirmPwd"),
      strengthWrap: $("strengthWrap"),
      strengthBar: document.querySelector("#strengthWrap .strength-bar"),
      strengthLabel: $("strengthLabel"),
      rules: [...document.querySelectorAll("#pwdRules li")],
      changePassword: $("changePasswordBtn"),
      sessionsList: $("sessionsList"),
      revokeOthers: $("revokeOthersBtn"),
      prefList: $("prefList"),
      toasts: $("acctToasts"),
    };

    let me = null;

    const toast = (message, type = "info") => {
      const node = document.createElement("div");
      node.className = `acct-toast ${type}`;
      node.innerHTML = `${icon(type === "success" ? "check" : type === "danger" ? "close" : "bell")}<span>${esc(message)}</span>`;
      el.toasts.appendChild(node);
      setTimeout(() => {
        node.classList.add("hide");
        setTimeout(() => node.remove(), 300);
      }, 3000);
    };

    const errText = (e) => String(e?.message || e?.error || e || "حدث خطأ غير متوقع");
    const busy = (btn, state, label) => {
      btn.disabled = state;
      if (label) btn.textContent = label;
    };

    /* -------------------------------------------------- */
    /* الملف الشخصي والإحصاءات                             */
    /* -------------------------------------------------- */
    const fillPersonal = () => {
      if (!me) return;
      el.fullName.value = me.name || "";
      el.emailInput.value = me.email || "";
      el.phone.value = me.phone || "";
      el.codeInput.value = me.platform_id || "—";
      el.levelInput.value =
        me.job_position || (me.level ? `المستوى ${me.level}` : "—");
    };

    const paintHeader = () => {
      if (!me) return;
      el.name.textContent = me.name || "مستخدم";
      el.avatar.textContent = (me.name || "أ").trim().charAt(0);
      el.role.textContent = ROLE_LABEL[me.role] || "عضو";
      el.email.textContent = me.email || "لا يوجد بريد تواصل مسجّل";
      el.code.textContent = me.platform_id || "—";
      el.notice.hidden = !me.must_change_password;
    };

    const loadAccount = async () => {
      const [p, s] = await Promise.all([
        call("my_profile"),
        call("my_account_stats"),
      ]);
      if (!p.ok) throw new Error(p.error);
      me = Array.isArray(p.data) ? p.data[0] : p.data;
      paintHeader();
      fillPersonal();

      if (s.ok) {
        const row = Array.isArray(s.data) ? s.data[0] : s.data;
        el.statCourses.textContent = String(row?.courses_count ?? 0);
        el.statUnread.textContent = String(row?.unread_count ?? 0);
      }
    };

    el.resetPersonal.addEventListener("click", () => {
      fillPersonal();
      toast("تمت استعادة القيم المحفوظة");
    });

    el.personalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = el.fullName.value.trim();
      if (name.length < 2) {
        toast("الاسم يجب أن يكون حرفين على الأقل", "warning");
        el.fullName.focus();
        return;
      }
      busy(el.savePersonal, true, "جارٍ الحفظ…");
      const res = await call("update_my_profile", {
        p_name: name,
        p_email: el.emailInput.value.trim(),
        p_phone: el.phone.value.trim(),
      });
      busy(el.savePersonal, false, "حفظ التغييرات");
      if (!res.ok) {
        toast(errText(res), "danger");
        return;
      }
      await loadAccount();
      toast("تم حفظ بياناتك بنجاح", "success");
    });

    /* -------------------------------------------------- */
    /* كلمة المرور                                         */
    /* -------------------------------------------------- */
    document.querySelectorAll(".pwd-toggle").forEach((btn) => {
      btn.innerHTML = icon("eye");
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        btn.innerHTML = icon(reveal ? "eyeOff" : "eye");
        btn.setAttribute("aria-label", reveal ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
        btn.setAttribute("aria-pressed", String(reveal));
      });
    });

    el.newPwd.addEventListener("input", () => {
      const value = el.newPwd.value;
      el.strengthWrap.hidden = value.length === 0;
      el.rules.forEach((li) => {
        const rule = PASSWORD_RULES.find((r) => r.key === li.dataset.req);
        li.classList.toggle("met", Boolean(rule?.test(value)));
      });
      const met = PASSWORD_RULES.filter((r) => r.test(value)).length;
      const level = met <= 1 ? "weak" : met === 2 ? "fair" : met === 3 ? "good" : "strong";
      const labels = { weak: "ضعيفة", fair: "متوسطة", good: "جيدة", strong: "قوية" };
      el.strengthBar.querySelectorAll("i").forEach((seg, i) => {
        seg.className = i < met ? level : "";
      });
      el.strengthLabel.textContent = `قوة كلمة المرور: ${labels[level]}`;
    });

    el.passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const current = el.currentPwd.value;
      const next = el.newPwd.value;
      if (!current) {
        toast("أدخل كلمة المرور الحالية أولاً", "warning");
        el.currentPwd.focus();
        return;
      }
      if (!PASSWORD_RULES.every((r) => r.test(next))) {
        toast("كلمة المرور الجديدة لا تستوفي جميع المتطلبات", "warning");
        el.newPwd.focus();
        return;
      }
      if (next !== el.confirmPwd.value) {
        toast("كلمة المرور الجديدة وتأكيدها غير متطابقين", "warning");
        el.confirmPwd.focus();
        return;
      }

      const user = await currentUser();
      if (!user?.email) {
        toast("تعذّر التحقق من كلمة المرور الحالية", "danger");
        return;
      }

      busy(el.changePassword, true, "جارٍ التحديث…");
      const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (check.error) {
        busy(el.changePassword, false, "تحديث كلمة المرور");
        toast("كلمة المرور الحالية غير صحيحة", "danger");
        return;
      }
      const updated = await supabase.auth.updateUser({ password: next });
      if (updated.error) {
        busy(el.changePassword, false, "تحديث كلمة المرور");
        toast(errText(updated.error), "danger");
        return;
      }
      const marked = await call("mark_password_changed");
      busy(el.changePassword, false, "تحديث كلمة المرور");
      el.passwordForm.reset();
      el.strengthWrap.hidden = true;
      el.rules.forEach((li) => li.classList.remove("met"));
      el.strengthBar.querySelectorAll("i").forEach((seg) => (seg.className = ""));
      if (me) me.must_change_password = false;
      el.notice.hidden = true;
      toast(
        marked.ok ? "تم تحديث كلمة المرور بنجاح" : "تم تغيير كلمة المرور؛ تعذّر تحديث علم الحساب",
        marked.ok ? "success" : "warning"
      );
    });

    /* -------------------------------------------------- */
    /* الجلسة الحالية                                      */
    /* -------------------------------------------------- */
    const describeDevice = (ua) => {
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
        return { label: "هاتف / جهاز محمول", icon: "mobile" };
      }
      if (/Macintosh|Windows|Linux|X11/i.test(ua)) {
        return { label: "حاسوب", icon: "monitor" };
      }
      return { label: "جهاز آخر", icon: "shield" };
    };

    const paintSession = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user || null;
      const device = describeDevice(navigator.userAgent || "");
      const last = user?.last_sign_in_at || user?.created_at;
      el.sessionsList.innerHTML = `
        <div class="session-item current">
          <span class="session-icon">${icon(device.icon)}</span>
          <div class="session-info">
            <h4>${esc(device.label)} <span class="session-badge">الجلسة الحالية</span></h4>
            <p>${icon("clock")}<span>آخر تسجيل دخول: ${esc(fmtDateTime(last))}</span></p>
            <p>${icon("shield")}<span>هذه هي الجلسة التي تستخدمها الآن</span></p>
          </div>
        </div>`;
    };

    el.revokeOthers.addEventListener("click", async () => {
      busy(el.revokeOthers, true, "جارٍ الإنهاء…");
      const { error } = await supabase.auth.signOut({ scope: "others" });
      busy(el.revokeOthers, false, "إنهاء جميع الجلسات الأخرى");
      if (error) toast(errText(error), "danger");
      else toast("تم إنهاء الجلسات الأخرى، وبقيت جلستك الحالية نشطة", "success");
    });

    /* -------------------------------------------------- */
    /* تفضيلات الإشعارات                                   */
    /* -------------------------------------------------- */
    const loadPreferences = async () => {
      const res = await call("my_notification_preferences");
      if (!res.ok) return;
      const rows = Array.isArray(res.data) ? res.data : [];
      el.prefList.querySelectorAll("input[data-pref]").forEach((input) => {
        const row = rows.find((r) => r.category === input.dataset.pref);
        input.checked = row ? row.enabled !== false : true;
      });
    };

    el.prefList.addEventListener("change", async (e) => {
      const input = e.target.closest("input[data-pref]");
      if (!input) return;
      const wanted = input.checked;
      const res = await call("set_notification_preference", {
        p_category: input.dataset.pref,
        p_enabled: wanted,
      });
      if (!res.ok) {
        input.checked = !wanted;
        toast(errText(res), "danger");
      } else {
        toast(wanted ? "تم تفعيل هذا النوع من الإشعارات" : "تم إيقاف هذا النوع من الإشعارات", "success");
      }
    });

    /* -------------------------------------------------- */
    /* التنقّل الداخلي                                     */
    /* -------------------------------------------------- */
    const links = [...el.nav.querySelectorAll('a[href^="#"]')];
    const syncNav = () => {
      const hash = location.hash || "#personal";
      links.forEach((a) => {
        const active = a.getAttribute("href") === hash;
        a.classList.toggle("active", active);
        if (active) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    };
    links.forEach((a) => a.addEventListener("click", syncNav));
    window.addEventListener("hashchange", syncNav);
    syncNav();

    /* -------------------------------------------------- */
    /* التحميل                                             */
    /* -------------------------------------------------- */
    try {
      await Promise.all([loadAccount(), loadPreferences(), paintSession()]);
    } catch (err) {
      toast(`تعذّر تحميل بيانات الحساب: ${errText(err)}`, "danger");
    }
  },
});

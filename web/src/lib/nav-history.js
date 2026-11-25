// سجل تنقّل داخل التطبيق في sessionStorage.
// لا نعتمد على window.history.length لأنه قد يشمل مدخلات خارج البوابة.
const KEY = "alzain_nav_history";
const LIMIT = 50;

function isEntry(entry) {
  return Boolean(entry) && typeof entry.url === "string" && entry.url.startsWith("/");
}

function read() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(stack) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-LIMIT)));
  } catch {
    // التخزين معطّل: التنقّل يعمل، لكن سجل الرجوع يبقى في الذاكرة فقط.
  }
}

function currentUrl() {
  return `${location.pathname}${location.search}${location.hash}`;
}

// يُستدعى مرة عند تحميل أي صفحة بوابة.
export function initNavHistory(url = currentUrl()) {
  const stack = read();
  if (!stack.length) {
    write([{ url, scrollY: 0 }]);
    return;
  }
  const last = stack[stack.length - 1];
  if (last.url !== url) {
    stack.push({ url, scrollY: 0 });
    write(stack);
  }
}

// يُستدعى قبل pushState عند التنقّل الناعم: نحفظ موضع الصفحة الحالية
// ونضيف الصفحة الهدف كمدخل جديد في سجل التطبيق.
export function recordNavigation(toUrl, fromScrollY = 0) {
  let stack = read();
  if (!stack.length) {
    initNavHistory();
    stack = read();
  }

  const fromUrl = currentUrl();
  let last = stack[stack.length - 1];
  if (last.url !== fromUrl) {
    stack = [{ url: fromUrl, scrollY: Number(fromScrollY) || 0 }];
  } else {
    last.scrollY = Number(fromScrollY) || 0;
  }

  // pushState يضيف مدخلاً جديداً دائماً؛ حذف المدخلات اللاحقة يحدث في popstate.
  stack.push({ url: toUrl, scrollY: 0 });
  write(stack);
}

// الرجوع إلى مدخل موجود بعد popstate: نحذف المدخلات اللاحقة ونستعيد موضع التمرير.
export function syncNavHistory(url = currentUrl()) {
  const stack = read();
  let index = -1;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].url === url) {
      index = i;
      break;
    }
  }
  if (index === -1) {
    write([{ url, scrollY: 0 }]);
    return 0;
  }
  const scrollY = Number(stack[index].scrollY) || 0;
  stack.length = index + 1;
  write(stack);
  return scrollY;
}

// الصفحة السابقة داخل التطبيق فقط؛ لا شيء إذا كانت هذه أول صفحة.
export function previousEntry() {
  const stack = read();
  return stack.length > 1 ? stack[stack.length - 2] : null;
}

export function clearNavHistory() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // لا يوجد ما يُمسح إذا كان التخزين معطّلاً.
  }
}

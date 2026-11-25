// دوال التنظيف الخاصة بالصفحة الحالية. تستدعى قبل تركيب أي صفحة جديدة.
const disposers = new Set();

export function onDispose(fn) {
  if (typeof fn === "function") disposers.add(fn);
  return fn;
}

export function disposeAll() {
  for (const fn of [...disposers]) {
    try {
      fn();
    } catch (err) {
      console.error("dispose error", err);
    }
  }
  disposers.clear();
}

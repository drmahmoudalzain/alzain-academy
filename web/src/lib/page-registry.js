// سجل مؤقت للصفحة التي يجري تركيبها أثناء التنقّل الناعم.
// وحدة الصفحة تسجّل mount أثناء الاستيراد، ثم يأخذه الموجّه وينفّذه.
const mounts = new Map();
let pendingPreset = "";
let softNav = false;

export function registerPage(key, mount) {
  mounts.set(key, mount);
}

export function takeMount(key) {
  const mount = mounts.get(key) ?? null;
  mounts.delete(key);
  return mount;
}

export function setPendingPreset(html) {
  pendingPreset = html ?? "";
}

export function takePendingPreset() {
  const html = pendingPreset;
  pendingPreset = "";
  return html;
}

export function beginSoftNav() {
  softNav = true;
}

export function endSoftNav() {
  softNav = false;
}

export function isSoftNav() {
  return softNav;
}

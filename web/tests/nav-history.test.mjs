import assert from "node:assert/strict";
import test from "node:test";

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

globalThis.location = {
  pathname: "/alzain-academy/pages/owner/lectures.html",
  search: "",
  hash: "",
};

const {
  initNavHistory,
  recordNavigation,
  previousEntry,
  syncNavHistory,
} = await import("../src/lib/nav-history.js");

function reset(path = "/alzain-academy/pages/owner/lectures.html") {
  store.clear();
  location.pathname = path;
  location.search = "";
  location.hash = "";
}

test("initNavHistory seeds a single entry for the current page", () => {
  reset();
  initNavHistory();
  assert.deepEqual(previousEntry(), null);
  assert.equal(JSON.parse(store.get("alzain_nav_history")).length, 1);
});

test("recordNavigation keeps the previous page and its scroll position", () => {
  const dashboard = "/alzain-academy/pages/owner/dashboard.html";
  reset();
  initNavHistory();
  recordNavigation(dashboard, 640);
  location.pathname = dashboard;

  const stack = JSON.parse(store.get("alzain_nav_history"));
  assert.equal(stack.length, 2);
  assert.equal(stack[0].url, "/alzain-academy/pages/owner/lectures.html");
  assert.equal(stack[0].scrollY, 640);
  assert.equal(stack[1].url, dashboard);
  assert.equal(stack[1].scrollY, 0);
  assert.equal(previousEntry().url, "/alzain-academy/pages/owner/lectures.html");
});

test("syncNavHistory returns to the earlier page and drops forward entries", () => {
  const lectures = "/alzain-academy/pages/owner/lectures.html";
  const dashboard = "/alzain-academy/pages/owner/dashboard.html";
  const courses = "/alzain-academy/pages/owner/courses.html";

  reset();
  initNavHistory();
  recordNavigation(dashboard, 640);
  location.pathname = dashboard;
  recordNavigation(courses, 120);
  location.pathname = courses;

  const scrollY = syncNavHistory(dashboard);
  assert.equal(scrollY, 120);
  const stack = JSON.parse(store.get("alzain_nav_history"));
  assert.deepEqual(
    stack.map((entry) => entry.url),
    [lectures, dashboard],
  );
  assert.equal(previousEntry().url, lectures);
});

test("syncNavHistory restores the scroll saved when leaving a page", () => {
  const lectures = "/alzain-academy/pages/owner/lectures.html";
  const dashboard = "/alzain-academy/pages/owner/dashboard.html";

  reset();
  initNavHistory();
  recordNavigation(dashboard, 640);
  location.pathname = dashboard;
  syncNavHistory(dashboard);
  recordNavigation(lectures, 300);
  location.pathname = lectures;

  assert.equal(syncNavHistory(lectures), 0);
  assert.equal(syncNavHistory(dashboard), 300);
});

test("a full navigation to a new page resets the in-app stack", () => {
  reset();
  initNavHistory();
  location.pathname = "/alzain-academy/pages/owner/dashboard.html";
  recordNavigation("/alzain-academy/pages/owner/courses.html", 40);

  const stack = JSON.parse(store.get("alzain_nav_history"));
  assert.deepEqual(
    stack.map((entry) => entry.url),
    [
      "/alzain-academy/pages/owner/dashboard.html",
      "/alzain-academy/pages/owner/courses.html",
    ],
  );
});

test("corrupt storage starts with a clean stack", () => {
  reset();
  store.set("alzain_nav_history", "{not json");
  initNavHistory();
  assert.equal(previousEntry(), null);
  assert.equal(JSON.parse(store.get("alzain_nav_history")).length, 1);
});

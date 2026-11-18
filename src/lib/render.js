// عرض صفحة داخل تخطيط (layout) دون حزمة خارجية.
export function renderView(res, view, locals) {
  return new Promise((resolve, reject) => {
    res.render(view, locals, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

export async function renderPage(res, view, locals = {}) {
  const layout = locals.layout ?? "app";
  const body = await renderView(res, view, locals);
  const html = await renderView(res, `layouts/${layout}`, { ...locals, body });
  res.type("html").send(html);
}

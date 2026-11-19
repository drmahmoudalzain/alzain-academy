import * as format from "./format.js";
import { getProfile, parseTrackKey, isSeparateTrack, isMixedTrack, TRACK_KEYS, DEFAULT_TRACK } from "./tracks.js";

// عرض صفحة داخل تخطيط (layout) دون حزمة خارجية.
export function renderView(res, view, locals) {
  return new Promise((resolve, reject) => {
    res.render(view, locals, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

export async function renderPage(res, view, locals = {}) {
  const layout = locals.layout ?? "portal";
  const data = {
    ...locals,
    format,
    getProfile,
    parseTrackKey,
    isSeparateTrack,
    isMixedTrack,
    TRACK_KEYS,
    DEFAULT_TRACK,
  };
  const body = await renderView(res, view, data);
  if (layout === false) {
    res.type("html").send(body);
    return;
  }
  const html = await renderView(res, `layouts/${layout}`, { ...data, body });
  res.type("html").send(html);
}

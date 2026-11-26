export const BACHELOR_TRACKS = ["bachelor_m", "bachelor_f"];
export const LEVELS = [0, 1, 2, 3, 4];

const FILTER_TRACKS = ["all", "bachelor", "equiv", "external", "grad", ...BACHELOR_TRACKS];
const VALID_LEVELS = ["1", "2", "3", "4"];

export function isBachelorTrack(track) {
  return track === "bachelor" || BACHELOR_TRACKS.includes(track);
}

export function levelOf(student) {
  const level = Number(student?.level);
  return Number.isInteger(level) && level >= 1 && level <= 4 ? level : 0;
}

export function bachelorStudents(students) {
  return (Array.isArray(students) ? students : []).filter((student) => BACHELOR_TRACKS.includes(student?.track));
}

export function countTracks(students) {
  const counts = { all: students.length, bachelor: bachelorStudents(students).length };
  for (const track of ["bachelor_m", "bachelor_f", "equiv", "external", "grad"]) {
    counts[track] = students.filter((student) => student.track === track).length;
  }
  return counts;
}

export function countLevels(students) {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, 0]));
  for (const student of bachelorStudents(students)) counts[levelOf(student)] += 1;
  return counts;
}

export function countGenders(students, level = "") {
  const scoped = bachelorStudents(students).filter(
    (student) => !level || levelOf(student) === Number(level),
  );
  return {
    bachelor: scoped.length,
    bachelor_m: scoped.filter((student) => student.track === "bachelor_m").length,
    bachelor_f: scoped.filter((student) => student.track === "bachelor_f").length,
  };
}

export function isLevelDisabled(level) {
  return Number(level) === 0;
}

export function parseFilters(params) {
  const values = new URLSearchParams(params);
  const requestedTrack = values.get("track") || "all";
  const requestedLevel = values.get("level") || "";
  const track = FILTER_TRACKS.includes(requestedTrack) ? requestedTrack : "all";
  const level = isBachelorTrack(track) && VALID_LEVELS.includes(requestedLevel) ? requestedLevel : "";
  return { track, level, q: values.get("q") || "" };
}

export function buildFilterParams(filters, current = "") {
  const params = new URLSearchParams(current);
  const track = FILTER_TRACKS.includes(filters?.track) ? filters.track : "all";
  params.set("track", track);

  const requestedLevel = String(filters?.level || "");
  const level = isBachelorTrack(track) && VALID_LEVELS.includes(requestedLevel) ? requestedLevel : "";
  if (level) params.set("level", level);
  else params.delete("level");

  const query = String(filters?.q || "");
  if (query) params.set("q", query);
  else params.delete("q");

  return params;
}

export function serializeFilters(filters, current = "") {
  return buildFilterParams(filters, current).toString();
}

export function studentMatches(student, filters) {
  const track = filters?.track || "all";
  const level = filters?.level || "";
  const inTrack = track === "all"
    || (track === "bachelor" ? BACHELOR_TRACKS.includes(student.track) : student.track === track);
  const inLevel = !level
    || !BACHELOR_TRACKS.includes(student.track)
    || levelOf(student) === Number(level);
  const haystack = [student.name, student.platform_id, student.email, student.university_id]
    .join(" ")
    .toLocaleLowerCase();
  const query = String(filters?.q || "").toLocaleLowerCase();
  return inTrack && inLevel && (!query || haystack.includes(query));
}

export function filterStudents(students, filters) {
  return (Array.isArray(students) ? students : []).filter((student) => studentMatches(student, filters));
}

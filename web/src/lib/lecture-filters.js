const ALL = "all";

export function filterLectures(lectures, filters = {}) {
  if (!Array.isArray(lectures)) return [];

  const course = String(filters.course ?? ALL);
  const status = String(filters.status ?? ALL);
  const type = String(filters.type ?? ALL);
  const query = String(filters.query ?? "").trim().toLocaleLowerCase();

  return lectures.filter((lecture) => {
    if (!lecture || typeof lecture !== "object") return false;
    if (course !== ALL && String(lecture.course_id ?? "") !== course) return false;
    if (status !== ALL && String(lecture.status ?? "") !== status) return false;
    if (type !== ALL && String(lecture.lecture_type ?? "") !== type) return false;
    if (!query) return true;

    return [
      lecture.title,
      lecture.description,
      lecture.course_title,
      lecture.course_code,
      lecture.teacher,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
  });
}

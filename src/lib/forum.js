import { db } from "./supabase.js";
import { isFounder } from "./portals.js";

/** الغرف المتاحة للمستخدم: العامة + غرف مقرراته (الأستاذ: مقرراته، المالك: الجميع). */
export async function listRoomsFor(user) {
  const { data: rooms, error } = await db
    .from("chat_rooms")
    .select("id, name, kind, course_id, created_at, courses(id, title, code, color, teacher_id, archived)")
    .order("kind", { ascending: false })
    .order("id");
  if (error) throw error;

  const all = rooms ?? [];
  const isOwner = await isFounder(user);

  let filtered = all.filter((room) => {
    if (room.kind === "general") return true;
    if (isOwner) return room.courses && !room.courses.archived;
    if (user.role === "teacher") return room.courses && room.courses.teacher_id === user.id && !room.courses.archived;
    return false;
  });

  if (user.role === "student") {
    const enrollRes = await db.from("enrollments").select("course_id").eq("student_id", user.id);
    if (enrollRes.error) throw enrollRes.error;
    const courseIds = new Set((enrollRes.data ?? []).map((row) => row.course_id));
    filtered = filtered.filter((room) => room.kind === "general" || courseIds.has(room.course_id));
  }

  return filtered;
}

/** هل يمكن للمستخدم دخول هذه الغرفة؟ */
export async function canAccessRoom(user, room) {
  if (!room) return false;
  if (room.kind === "general") return true;

  const isOwner = await isFounder(user);
  if (isOwner) return true;

  if (user.role === "teacher") {
    const { data, error } = await db
      .from("courses")
      .select("id, teacher_id, archived")
      .eq("id", room.course_id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data && data.teacher_id === user.id && !data.archived);
  }

  const enrollRes = await db
    .from("enrollments")
    .select("course_id")
    .eq("student_id", user.id)
    .eq("course_id", room.course_id)
    .maybeSingle();
  if (enrollRes.error) throw enrollRes.error;
  return Boolean(enrollRes.data);
}

/** جلب الغرفة مع التحقق من الصلاحية — تعيد null عند عدم السماح. */
export async function getAccessibleRoom(user, roomId) {
  const { data, error } = await db
    .from("chat_rooms")
    .select("id, name, kind, course_id, created_at, courses(id, title, code, color, teacher_id, archived)")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await canAccessRoom(user, data))) return null;
  return data;
}

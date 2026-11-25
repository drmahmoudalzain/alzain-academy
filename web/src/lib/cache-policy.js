// سياسة الكاش صريحة: أي RPC ليس في هاتين القائمتين لا يُخزَّن ولا يُبطل شيئاً.
const CACHEABLE = new Set([
  "my_profile",
  "my_account_stats",
  "my_notification_preferences",
  "ai_public_settings",
  "ai_conversations",
  "ai_conversation_messages",
  "student_dashboard",
  "student_courses",
  "student_lectures",
  "student_lecture_detail",
  "student_exams",
  "student_exam_take",
  "student_assignments",
  "student_grades",
  "student_points",
  "teacher_dashboard",
  "teacher_courses",
  "teacher_course_detail",
]);

const INVALIDATES = new Set([
  "update_my_profile",
  "mark_password_changed",
  "set_notification_preference",
  "ai_create_conversation",
  "ai_append_user_message",
  "ai_delete_conversation",
  "ai_delete_last_assistant_message",
  "ai_clear_history",
  "student_exam_save_answer",
  "student_exam_submit",
  "student_assignment_submit",
  "student_lecture_attendance",
  "management_create_course",
  "management_update_course",
  "management_assign_course_teacher",
  "management_add_lecture",
  "management_create_exam",
  "teacher_create_assignment",
  "management_grade_submission",
  "management_enroll_student",
  "management_set_attendance",
  "management_post_announcement",
]);

const PROFILE_TTL = 300000;

export function isCacheable(fn) {
  return CACHEABLE.has(fn);
}

export function isInvalidating(fn) {
  return INVALIDATES.has(fn);
}

export function ttlFor(fn) {
  return fn === "my_profile" ? PROFILE_TTL : 60000;
}

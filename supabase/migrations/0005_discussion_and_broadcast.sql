-- ============================================================
-- 0004 — أسئلة النقاش + وسائط البث للمحاضرات
-- ============================================================

begin;

-- 1) نوع جديد للأسئلة: نقاش عام (بلا نقاط)
alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check
  check (type in ('poll','mcq','multi','truefalse','discussion'));

-- 2) محددات البث للمحاضرة
alter table public.lectures add column if not exists broadcast_mode text;
alter table public.lectures add column if not exists broadcast_media text;
alter table public.lectures drop constraint if exists lectures_broadcast_mode_check;
alter table public.lectures drop constraint if exists lectures_broadcast_media_check;
alter table public.lectures add constraint lectures_broadcast_mode_check
  check (broadcast_mode in ('internal','youtube','meet') or broadcast_mode is null);
alter table public.lectures add constraint lectures_broadcast_media_check
  check (broadcast_media in ('audio','video','both') or broadcast_media is null);

commit;

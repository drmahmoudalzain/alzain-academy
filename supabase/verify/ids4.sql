select 'q:'||eq.id||'|'||eq.type||'|'||eq.position from public.exam_questions eq join public.exams e on e.id = eq.exam_id where e.title = 'اختبار — قانون العقوبات' order by eq.position;

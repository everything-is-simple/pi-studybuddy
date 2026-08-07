/**
 * T-M0-006 semester.db schema DDL（05-ERD §3 + §6 + §7.2）
 *
 * 单学期全量业务数据（S1-S7）：25 表 + 9 触发器 + 索引。
 * 跨库外键（semester_id 引用 global.semesters）不建 FK，仅同库 FK。
 */

/** semester.db 25 表 + 9 触发器 + 索引 DDL（05-ERD §3 + §6） */
export const SEMESTER_SCHEMA_SQL = `
-- ===== S1 学习节奏 =====
-- 3.1.1 course_instances
CREATE TABLE course_instances (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher TEXT,
  daily_minutes_target INTEGER DEFAULT 60,
  available_time_json TEXT,
  target_score_json TEXT,
  retake_of TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_course_semester ON course_instances(semester_id);
CREATE INDEX idx_course_subject ON course_instances(subject);

-- 3.1.2 assessment_attempts
CREATE TABLE assessment_attempts (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  exam_name TEXT NOT NULL,
  exam_type TEXT NOT NULL
    CHECK (exam_type IN ('midterm', 'final', 'makeup', 'retake', 'quiz')),
  scheduled_date TEXT,
  actual_date TEXT,
  confirmation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected', 'superseded')),
  confirmed_at TEXT,
  confirmed_by TEXT,
  source TEXT,
  confidence REAL,
  change_history_json TEXT,
  retake_of TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_assessment_course ON assessment_attempts(course_instance_id);
CREATE INDEX idx_assessment_status ON assessment_attempts(confirmation_status);
CREATE INDEX idx_assessment_date ON assessment_attempts(scheduled_date);

-- 3.1.3 schedule_entries
CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  week_pattern TEXT DEFAULT 'every',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (end_time > start_time)
);
CREATE INDEX idx_schedule_course ON schedule_entries(course_instance_id);
CREATE INDEX idx_schedule_weekday ON schedule_entries(weekday);

-- 3.1.4 study_tasks
CREATE TABLE study_tasks (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL
    CHECK (task_type IN ('review', 'practice', 'note', 'exam_prep', 'other')),
  due_date TEXT,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  source_system TEXT NOT NULL,
  source_ref_id TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_task_course ON study_tasks(course_instance_id);
CREATE INDEX idx_task_status ON study_tasks(status);
CREATE INDEX idx_task_due ON study_tasks(due_date) WHERE deleted_at IS NULL;

-- 3.1.5 study_events
CREATE TABLE study_events (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL,
  course_instance_id TEXT REFERENCES course_instances(id),
  event_type TEXT NOT NULL,
  source_system TEXT NOT NULL CHECK (source_system IN ('S1','S2','S3','S4','S5','S6','S7')),
  source_ref_id TEXT,
  event_data_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_event_semester ON study_events(semester_id);
CREATE INDEX idx_event_course ON study_events(course_instance_id);
CREATE INDEX idx_event_type ON study_events(event_type);
CREATE INDEX idx_event_time ON study_events(occurred_at DESC);

-- ===== S2 资料笔记 =====
-- 3.2.1 materials
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'class_audio_transcription')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converting', 'converted', 'note_generating', 'completed',
                      'conversion_failed', 'pending_quality_check')),
  permission_confirmed INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL,
  converted_at TEXT,
  note_generated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_material_course ON materials(course_instance_id);
CREATE INDEX idx_material_status ON materials(status);

-- 3.2.2 normalized_texts
CREATE TABLE normalized_texts (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  source_type TEXT,
  extraction_meta_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(material_id)
);
CREATE INDEX idx_normtext_material ON normalized_texts(material_id);
CREATE INDEX idx_normtext_hash ON normalized_texts(content_hash);

-- 3.2.3 structured_notes
CREATE TABLE structured_notes (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  note_markdown TEXT NOT NULL,
  highlights_json TEXT,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,
  token_count INTEGER,
  ai_generated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(material_id)
);
CREATE INDEX idx_note_material ON structured_notes(material_id);
CREATE INDEX idx_note_course ON structured_notes(course_instance_id);

-- 3.2.4 mind_maps
CREATE TABLE mind_maps (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  markmap_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(material_id)
);
CREATE INDEX idx_mindmap_material ON mind_maps(material_id);

-- 3.2.5 knowledge_modules
CREATE TABLE knowledge_modules (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  module_name TEXT NOT NULL,
  summary TEXT,
  importance INTEGER CHECK (importance BETWEEN 1 AND 5),
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  learn_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (learn_status IN ('not_started', 'learning', 'mastered', 'needs_review')),
  source_evidence_json TEXT NOT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_kmodule_course ON knowledge_modules(course_instance_id);
CREATE INDEX idx_kmodule_material ON knowledge_modules(material_id);
CREATE INDEX idx_kmodule_status ON knowledge_modules(learn_status);

-- 3.2.6 material_chunks
CREATE TABLE material_chunks (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  section_path TEXT,
  page_number INTEGER,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(material_id, chunk_index)
);
CREATE INDEX idx_chunk_material ON material_chunks(material_id);
CREATE INDEX idx_chunk_section ON material_chunks(section_path);

-- 3.2.7 jobs
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  job_type TEXT NOT NULL
    CHECK (job_type IN ('convert_pdf', 'convert_docx', 'convert_pptx', 'convert_xlsx',
                        'ocr_image', 'wps_convert', 'generate_note')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  timeout_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_job_material ON jobs(material_id);
CREATE INDEX idx_job_status ON jobs(status);

-- ===== S3 限时练习 =====
-- 3.3.1 questions
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  practice_session_id TEXT,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  knowledge_module_id TEXT REFERENCES knowledge_modules(id),
  question_type TEXT NOT NULL
    CHECK (question_type IN ('single_choice', 'multiple_choice', 'fill_blank')),
  question_stem TEXT NOT NULL,
  options_json TEXT,
  correct_answer TEXT,
  acceptable_answers_json TEXT,
  explanation TEXT,
  score INTEGER NOT NULL DEFAULT 1,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  source_evidence_json TEXT,
  ai_model TEXT,
  prompt_version TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_question_session ON questions(practice_session_id);
CREATE INDEX idx_question_course ON questions(course_instance_id);
CREATE INDEX idx_question_module ON questions(knowledge_module_id);

-- 3.3.2 practice_sessions
CREATE TABLE practice_sessions (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 5 AND 20),
  time_limit_minutes INTEGER,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  question_types_json TEXT NOT NULL,
  module_ids_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  graded_at TEXT,
  total_score INTEGER,
  max_score INTEGER,
  correct_count INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_psession_course ON practice_sessions(course_instance_id);
CREATE INDEX idx_psession_status ON practice_sessions(status);

-- 3.3.3 practice_answers
CREATE TABLE practice_answers (
  id TEXT PRIMARY KEY,
  practice_session_id TEXT NOT NULL REFERENCES practice_sessions(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  student_answer TEXT,
  is_correct INTEGER,
  graded_at TEXT,
  time_spent_ms INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(practice_session_id, question_id)
);
CREATE INDEX idx_panswer_session ON practice_answers(practice_session_id);
CREATE INDEX idx_panswer_question ON practice_answers(question_id);
CREATE INDEX idx_panswer_correct ON practice_answers(is_correct) WHERE is_correct = 0;

-- ===== S4 错题改错 =====
-- 3.4.1 mistakes
CREATE TABLE mistakes (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  knowledge_module_id TEXT REFERENCES knowledge_modules(id),
  error_cause TEXT,
  error_cause_category TEXT
    CHECK (error_cause_category IN ('concept_unclear', 'misread', 'formula_error',
                                     'step_missing', 'time_pressure', 'other')),
  error_cause_confirmed_by TEXT,
  error_cause_ai_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'mastered')),
  redo_count INTEGER NOT NULL DEFAULT 0,
  last_redo_correct INTEGER,
  mastered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(question_id)
);
CREATE INDEX idx_mistake_course ON mistakes(course_instance_id);
CREATE INDEX idx_mistake_module ON mistakes(knowledge_module_id);
CREATE INDEX idx_mistake_status ON mistakes(status);

-- 3.4.2 mistake_evidence
CREATE TABLE mistake_evidence (
  id TEXT PRIMARY KEY,
  mistake_id TEXT NOT NULL REFERENCES mistakes(id),
  source_practice_answer_id TEXT REFERENCES practice_answers(id),
  evidence_type TEXT NOT NULL DEFAULT 'initial_wrong'
    CHECK (evidence_type IN ('initial_wrong', 'redo_wrong')),
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_practice_answer_id)
);
CREATE INDEX idx_mevidence_mistake ON mistake_evidence(mistake_id);

-- 3.4.3 weak_points
CREATE TABLE weak_points (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  knowledge_module_id TEXT NOT NULL REFERENCES knowledge_modules(id),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'regressed')),
  first_evidenced_at TEXT NOT NULL,
  last_evidenced_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_instance_id, knowledge_module_id),
  CHECK (evidence_count >= 2)
);
CREATE INDEX idx_weak_course ON weak_points(course_instance_id);
CREATE INDEX idx_weak_module ON weak_points(knowledge_module_id);
CREATE INDEX idx_weak_status ON weak_points(status);

-- ===== S5 期末冲刺 =====
-- 3.5.1 mock_exam_papers
CREATE TABLE mock_exam_papers (
  id TEXT PRIMARY KEY,
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  assessment_attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id),
  paper_title TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  time_limit_minutes INTEGER,
  total_score INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mockpaper_course ON mock_exam_papers(course_instance_id);
CREATE INDEX idx_mockpaper_attempt ON mock_exam_papers(assessment_attempt_id);
CREATE INDEX idx_mockpaper_hash ON mock_exam_papers(source_hash);

-- 3.5.2 mock_exam_questions
CREATE TABLE mock_exam_questions (
  id TEXT PRIMARY KEY,
  mock_paper_id TEXT NOT NULL REFERENCES mock_exam_papers(id),
  question_index INTEGER NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('single_choice', 'multiple_choice', 'fill_blank')),
  question_stem TEXT NOT NULL,
  options_json TEXT,
  correct_answer TEXT,
  acceptable_answers_json TEXT,
  explanation TEXT,
  score INTEGER NOT NULL,
  knowledge_module_id TEXT REFERENCES knowledge_modules(id),
  created_at TEXT NOT NULL,
  CHECK (
    (question_type IN ('single_choice', 'multiple_choice') AND options_json IS NOT NULL)
    OR
    (question_type = 'fill_blank' AND options_json IS NULL)
  ),
  UNIQUE(mock_paper_id, question_index)
);
CREATE INDEX idx_mquestion_paper ON mock_exam_questions(mock_paper_id);

-- 3.5.3 mock_exam_attempts
CREATE TABLE mock_exam_attempts (
  id TEXT PRIMARY KEY,
  mock_paper_id TEXT NOT NULL REFERENCES mock_exam_papers(id),
  course_instance_id TEXT NOT NULL REFERENCES course_instances(id),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  graded_at TEXT,
  total_score INTEGER,
  max_score INTEGER,
  correct_count INTEGER,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mattempt_paper ON mock_exam_attempts(mock_paper_id);
CREATE INDEX idx_mattempt_status ON mock_exam_attempts(status);

-- 3.5.4 mock_exam_answers
CREATE TABLE mock_exam_answers (
  id TEXT PRIMARY KEY,
  mock_attempt_id TEXT NOT NULL REFERENCES mock_exam_attempts(id),
  mock_question_id TEXT NOT NULL REFERENCES mock_exam_questions(id),
  student_answer TEXT,
  is_correct INTEGER,
  time_spent_ms INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(mock_attempt_id, mock_question_id)
);
CREATE INDEX idx_manswer_attempt ON mock_exam_answers(mock_attempt_id);
CREATE INDEX idx_manswer_question ON mock_exam_answers(mock_question_id);

-- 3.5.5 mock_exam_module_analyses
CREATE TABLE mock_exam_module_analyses (
  id TEXT PRIMARY KEY,
  mock_attempt_id TEXT NOT NULL REFERENCES mock_exam_attempts(id),
  knowledge_module_id TEXT NOT NULL REFERENCES knowledge_modules(id),
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  accuracy_rate REAL NOT NULL,
  weakness_level TEXT NOT NULL
    CHECK (weakness_level IN ('strong', 'medium', 'weak')),
  created_at TEXT NOT NULL,
  UNIQUE(mock_attempt_id, knowledge_module_id)
);
CREATE INDEX idx_manalysis_attempt ON mock_exam_module_analyses(mock_attempt_id);

-- ===== S6 家长报告 =====
-- 3.6.1 parent_reports
CREATE TABLE parent_reports (
  report_key TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL,
  report_type TEXT NOT NULL
    CHECK (report_type IN ('daily', 'weekly', 'monthly', 'exam_reminder')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  rule_generated INTEGER NOT NULL DEFAULT 1,
  ai_polished INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,
  prompt_version TEXT,
  privacy_check_passed INTEGER NOT NULL DEFAULT 1,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_report_semester ON parent_reports(semester_id);
CREATE INDEX idx_report_type ON parent_reports(report_type);
CREATE INDEX idx_report_period ON parent_reports(period_start, period_end);

-- 3.6.2 report_deliveries
CREATE TABLE report_deliveries (
  report_key TEXT NOT NULL REFERENCES parent_reports(report_key),
  channel TEXT NOT NULL
    CHECK (channel IN ('local_export', 'smtp', 'feishu_webhook', 'print')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'retained_locally')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_code TEXT,
  sent_at TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (report_key, channel)
);
CREATE INDEX idx_delivery_status ON report_deliveries(status);

-- ===== 6. 触发器 =====
-- T1: question.course 必须匹配 practice_session.course
CREATE TRIGGER trg_question_course_consistency
BEFORE INSERT ON questions
FOR EACH ROW
WHEN NEW.practice_session_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN (SELECT course_instance_id FROM practice_sessions WHERE id = NEW.practice_session_id)
         != NEW.course_instance_id
    THEN RAISE(ABORT, 'question course mismatch with practice session')
  END;
END;

-- T2: mistake.question_id 必须存在且 course 一致
CREATE TRIGGER trg_mistake_question_consistency
BEFORE INSERT ON mistakes
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT course_instance_id FROM questions WHERE id = NEW.question_id)
         != NEW.course_instance_id
    THEN RAISE(ABORT, 'mistake course mismatch with question')
  END;
END;

-- T3: mistake_evidence.source_practice_answer_id 必须关联同一 mistake 的 question
CREATE TRIGGER trg_evidence_answer_consistency
BEFORE INSERT ON mistake_evidence
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT question_id FROM mistakes WHERE id = NEW.mistake_id)
         != (SELECT question_id FROM practice_answers WHERE id = NEW.source_practice_answer_id)
    THEN RAISE(ABORT, 'evidence answer does not belong to mistake question')
  END;
END;

-- T4: weak_points.course + module 必须一致
CREATE TRIGGER trg_weakpoint_consistency
BEFORE INSERT ON weak_points
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT course_instance_id FROM knowledge_modules WHERE id = NEW.knowledge_module_id)
         != NEW.course_instance_id
    THEN RAISE(ABORT, 'weak point module does not belong to course')
  END;
END;

-- T5: practice_answers.question_id 必须属于 practice_session
CREATE TRIGGER trg_answer_session_consistency
BEFORE INSERT ON practice_answers
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT practice_session_id FROM questions WHERE id = NEW.question_id)
         != NEW.practice_session_id
    THEN RAISE(ABORT, 'answer question does not belong to practice session')
  END;
END;

-- T6: mistake.knowledge_module_id 必须匹配 question 的 module
CREATE TRIGGER trg_mistake_module_consistency
BEFORE INSERT ON mistakes
FOR EACH ROW
WHEN NEW.knowledge_module_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN (SELECT knowledge_module_id FROM questions WHERE id = NEW.question_id)
         != NEW.knowledge_module_id
    THEN RAISE(ABORT, 'mistake module mismatch with question module')
  END;
END;

-- storage_key 路径逃逸防护（02-PRD §3.3）
CREATE TRIGGER trg_material_storage_key_safety
BEFORE INSERT ON materials
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.storage_key LIKE '%..%' OR NEW.storage_key LIKE '%:%' OR NEW.storage_key LIKE '%:/%'
    THEN RAISE(ABORT, 'storage_key path escape attempt detected')
  END;
END;

-- mock_exam_papers 校验 assessment_attempt confirmed（02-PRD §3.6）
CREATE TRIGGER trg_mockpaper_attempt_confirmed
BEFORE INSERT ON mock_exam_papers
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT confirmation_status FROM assessment_attempts WHERE id = NEW.assessment_attempt_id)
         != 'confirmed'
    THEN RAISE(ABORT, 'mock exam requires confirmed assessment attempt')
  END;
END;

-- mistake 幂等归档（02-PRD §3.5）
CREATE TRIGGER trg_mistake_idempotent_archive
BEFORE INSERT ON mistakes
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM mistakes WHERE question_id = NEW.question_id)
    THEN RAISE(ABORT, 'mistake already exists for this question, append evidence instead')
  END;
END;
`;

/** semester.db 表名清单（供测试断言，05-ERD §3） */
export const SEMESTER_TABLES = [
  "course_instances",
  "assessment_attempts",
  "schedule_entries",
  "study_tasks",
  "study_events",
  "materials",
  "normalized_texts",
  "structured_notes",
  "mind_maps",
  "knowledge_modules",
  "material_chunks",
  "jobs",
  "questions",
  "practice_sessions",
  "practice_answers",
  "mistakes",
  "mistake_evidence",
  "weak_points",
  "mock_exam_papers",
  "mock_exam_questions",
  "mock_exam_attempts",
  "mock_exam_answers",
  "mock_exam_module_analyses",
  "parent_reports",
  "report_deliveries",
];

/** semester.db 触发器名清单（供测试断言，05-ERD §6） */
export const SEMESTER_TRIGGERS = [
  "trg_question_course_consistency",
  "trg_mistake_question_consistency",
  "trg_evidence_answer_consistency",
  "trg_weakpoint_consistency",
  "trg_answer_session_consistency",
  "trg_mistake_module_consistency",
  "trg_material_storage_key_safety",
  "trg_mockpaper_attempt_confirmed",
  "trg_mistake_idempotent_archive",
];
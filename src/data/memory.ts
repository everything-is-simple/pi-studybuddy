/**
 * T-M0-006 三层记忆初始化（05-ERD §4）
 *
 * L1 学习者画像（JSON + events.jsonl）
 * L2 知识库索引（BM25 + 知识图谱：inverted_index/doc_lengths/graph_nodes/graph_edges）
 * L3 会话检索（conversation.sqlite：chunks 表 + chunks_fts FTS5 虚拟表）
 */
import { DatabaseSync } from "./sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPragmas, assertIntegrity, type DataDb } from "./db";
import { CONVERSATION_SCHEMA_SQL } from "./schema/conversation.sql";

/** L1 默认画像结构（05-ERD §4.1） */
const DEFAULT_PROFILE = {
  version: "1.0",
  student_id: "local-student",
  basic_info: {
    name: "",
    grade_level: "",
    available_time_per_weekday: {},
  },
  learning_preferences: {
    preferred_subjects: [],
    difficulty_tolerance: 3,
    review_style: "spaced_repetition",
  },
  weak_points_summary: [],
  goals: [],
  study_patterns: {
    avg_daily_minutes: 0,
    most_productive_time: "",
    consistency_score: 0,
  },
  updated_at: new Date().toISOString(),
};

/** L2 wiki-index 空结构约定（05-ERD §4.2） */
const L2_EMPTY_INDEX = {
  inverted_index: {}, // 词 → 文档 id 列表 + TF
  doc_lengths: {}, // 文档长度
  avg_doc_length: 0, // 平均文档长度
};
const L2_EMPTY_GRAPH_NODES: unknown[] = []; // 节点（knowledge_module / material / question）
const L2_EMPTY_GRAPH_EDGES: unknown[] = []; // 边（DIRECT_LINK 权重 0.5）

/**
 * 初始化 L1 画像目录（05-ERD §4.1）。
 * @param dir 业务数据根目录（memory 的父级）
 */
export function initMemoryL1(dir: string): void {
  const l1Dir = path.join(dir, "memory", "l1");
  mkdirSync(l1Dir, { recursive: true });
  const profilePath = path.join(l1Dir, "learner-profile.json");
  if (existsSync(profilePath) === false) {
    writeFileSync(profilePath, JSON.stringify(DEFAULT_PROFILE, null, 2), "utf8");
  }
  // events.jsonl 占位（空文件，每行一个 StudyEvent 摘要）
  const eventsPath = path.join(l1Dir, "events.jsonl");
  if (existsSync(eventsPath) === false) {
    writeFileSync(eventsPath, "", "utf8");
  }
}

/**
 * 初始化 L2 知识库索引目录骨架（05-ERD §4.2）。
 * @param dir 业务数据根目录（memory 的父级）
 */
export function initMemoryL2(dir: string): void {
  const l2Dir = path.join(dir, "memory", "l2", "wiki-index");
  mkdirSync(l2Dir, { recursive: true });
  writeFileSync(path.join(l2Dir, "inverted_index.json"), JSON.stringify(L2_EMPTY_INDEX, null, 2), "utf8");
  writeFileSync(path.join(l2Dir, "doc_lengths.json"), JSON.stringify({}, null, 2), "utf8");
  writeFileSync(path.join(l2Dir, "graph_nodes.json"), JSON.stringify(L2_EMPTY_GRAPH_NODES, null, 2), "utf8");
  writeFileSync(path.join(l2Dir, "graph_edges.json"), JSON.stringify(L2_EMPTY_GRAPH_EDGES, null, 2), "utf8");
}

/**
 * 初始化 L3 会话检索 schema（05-ERD §4.3）：chunks 表 + chunks_fts FTS5 虚拟表。
 * 作用于已打开并应用 PRAGMA 的数据库。
 */
export function initConversationDb(db: DatabaseSync): void {
  db.exec(CONVERSATION_SCHEMA_SQL);
}

/**
 * 初始化 L3 会话检索库（05-ERD §4.3）：conversation.sqlite + chunks + chunks_fts。
 * @param dir 业务数据根目录（memory 的父级）
 */
export function initMemoryL3(dir: string): DataDb {
  const l3Dir = path.join(dir, "memory", "l3");
  mkdirSync(l3Dir, { recursive: true });
  const filePath = path.join(l3Dir, "conversation.sqlite");
  const db = new DatabaseSync(filePath);
  applyPragmas(db);
  initConversationDb(db);
  assertIntegrity(db);
  return { path: filePath, db };
}
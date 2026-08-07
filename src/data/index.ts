/**
 * T-M0-006 数据层统一出口
 */
export { applyPragmas, assertIntegrity, openDatabase, type DataDb } from "./db";
export {
  createGlobalDb,
  initGlobalDb,
  GLOBAL_TABLES,
  GLOBAL_INDEXES,
} from "./global";
export {
  createSemesterDb,
  initSemesterDb,
  SEMESTER_TABLES,
  SEMESTER_TRIGGERS,
} from "./semester";
export {
  initMemoryL1,
  initMemoryL2,
  initMemoryL3,
  initConversationDb,
} from "./memory";
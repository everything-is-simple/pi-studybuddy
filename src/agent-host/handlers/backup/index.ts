/**
 * T-M2-005 备份恢复 handler 装配出口（06-API §3.11 + 03-Arch §6.2）
 *
 * createBackupHandlers(ctx) 返回 method→fn 映射，供 agent-host 注册。
 */
import type { BackupContext } from "./context";
import {
  handleBackupCourse,
  handleBackupAllCourses,
  handleRestore,
  handleList,
  handleConfigureSchedule,
  handleListSchedules,
  handleToggleSchedule,
} from "./backup";

export { BackupContext } from "./context";
export type { BackupProgressEvent } from "./context";

/** 备份恢复 handler 映射（06-API §3.11 七方法） */
export function createBackupHandlers(ctx: BackupContext) {
  return {
    "backup.course": handleBackupCourse(ctx),
    "backup.allCourses": handleBackupAllCourses(ctx),
    "backup.restore": handleRestore(ctx),
    "backup.list": handleList(ctx),
    "backup.configureSchedule": handleConfigureSchedule(ctx),
    "backup.listSchedules": handleListSchedules(ctx),
    "backup.toggleSchedule": handleToggleSchedule(ctx),
  };
}

/**
 * pi-studybuddy agent-host files handlers（06-API §3.2）
 *
 * files.watch / files.unwatch 两 RPC handler。file-access 权限检查 + 其他 files.*
 * 方法（selectDirectory/list/read/preview*）由后续任务补全。
 */
import type { FileWatchService } from "../file-watch";

export function createFileHandlers(service: FileWatchService) {
  return {
    "files.watch": async (params: unknown): Promise<void> => {
      const { path } = params as { path: string };
      await service.start(path);
    },
    "files.unwatch": (params: unknown): void => {
      const { path } = params as { path: string };
      service.stop(path);
    },
  };
}

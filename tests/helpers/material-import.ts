import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stageMaterialImport } from "../../src/shared/material-import";

/** 为直接调用 agent-host 的测试创建一次性 S2 文件导入 capability。 */
export function stageTestMaterial(
  dataRoot: string,
  sourceDir: string,
  fileName: string,
  mime: string,
  content = "test material content",
): { name: string; size: number; mime: string; importToken: string } {
  mkdirSync(sourceDir, { recursive: true });
  const sourcePath = path.join(sourceDir, fileName);
  writeFileSync(sourcePath, content);
  const staged = stageMaterialImport(dataRoot, sourcePath);
  return { name: staged.fileName, size: staged.fileSize, mime, importToken: staged.token };
}

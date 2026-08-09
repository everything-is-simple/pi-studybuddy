/**
 * 受控 skills.* handlers。
 *
 * v0.1 不从 agent-host 直接访问 GitHub 或修改仓库/用户技能目录；安装路径必须由后续
 * 已登记组件任务实现。此处保留完整 RPC 面并明确拒绝越权安装，防止 production 入口缺失。
 */
import type { SkillManifest } from "../../contract/types";

const INSTALLED_SKILLS: SkillManifest[] = [];

export function createSkillHandlers() {
  return {
    "skills.list": (): SkillManifest[] => [...INSTALLED_SKILLS],
    "skills.search": (_params: unknown): SkillManifest[] => [],
    "skills.install": (_params: unknown): SkillManifest => {
      throw { code: "BAD_REQUEST", message: "当前版本不支持从 GitHub 安装技能" };
    },
    "skills.getContent": (_params: unknown): { skillMd: string; helpers: string[] } => {
      throw { code: "NOT_FOUND", message: "技能不存在" };
    },
    "skills.uninstall": (_params: unknown): void => {
      throw { code: "NOT_FOUND", message: "技能不存在" };
    },
  };
}

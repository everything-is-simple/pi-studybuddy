import { describe, expect, it } from "vitest";
import { createSkillHandlers } from "../../src/agent-host/handlers/skills";
import {
  createStudyBuddySession,
  listStudyBuddyTools,
} from "../../src/agent-host/studybuddy-extension-loader";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-006\\managed-skills";

describe("T-M5-006 受管 pi native skills", () => {
  it("T-M5-006-SKILLS-01：pi 会话从应用受管资源发现 native skills，且 StudyBuddy extension 的 35 个工具仍完整存在", async () => {
    const session = await createStudyBuddySession({
      dataRoot: RUN_ROOT,
      agentDir: `${RUN_ROOT}\\isolated-agent`,
      cwd: RUN_ROOT,
      modelConfig: { provider: "deepseek", model: "DeepSeek V4 Flash", apiKey: "test-key" },
    });
    try {
      const loaded = session.session.resourceLoader.getSkills().skills;
      expect(loaded.map((skill) => skill.name).sort()).toEqual([
        "study-planning",
        "study-review",
      ]);
      expect(loaded.every((skill) => skill.filePath.includes("runtime-resources"))).toBe(true);
      expect(loaded.every((skill) => !skill.filePath.includes(".pi"))).toBe(true);
      expect(listStudyBuddyTools(session.session)).toHaveLength(35);
    } finally {
      await session.dispose();
    }
  }, 30_000);

  it("T-M5-006-SKILLS-02：skills.* 只展示和读取受管内容，不提供 GitHub 安装或卸载", () => {
    const handlers = createSkillHandlers();
    const skills = handlers["skills.list"]();

    expect(skills.map((skill) => skill.name).sort()).toEqual(["study-planning", "study-review"]);
    expect(handlers["skills.search"]({ query: "复习" }).map((skill) => skill.name)).toEqual(["study-review"]);
    expect(handlers["skills.getContent"]({ name: "study-planning" }).skillMd).toContain("name: study-planning");
    let installError: unknown;
    try {
      handlers["skills.install"]({ source: "github", hub: "x", name: "y" });
    } catch (error) {
      installError = error;
    }
    expect(installError).toMatchObject({
      code: "BAD_REQUEST",
      message: "当前版本仅提供随应用安装的学习技能",
    });

    let uninstallError: unknown;
    try {
      handlers["skills.uninstall"]({ name: "study-planning" });
    } catch (error) {
      uninstallError = error;
    }
    expect(uninstallError).toMatchObject({
      code: "BAD_REQUEST",
      message: "随应用安装的学习技能不能在此卸载",
    });
  });
});

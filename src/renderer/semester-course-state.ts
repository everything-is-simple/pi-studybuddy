/**
 * 学期/课程导航纯状态与读取适配（T-M4-007）。
 *
 * 设计边界：本模块只保存 renderer 可安全展示的名称、选择和加载状态；
 * 数据库路径、完整 UUID、原始 RPC 错误和密钥均不进入展示文本。
 */
import type { CourseInstance, Semester } from "../contract/types";
import type { TypedRpcClient } from "./rpc-client";

/** 当前工作台唯一的学期/课程上下文。 */
export interface SemesterCourseContext {
  semesterId?: string;
  courseId?: string;
  /** 当前学期归档时为 true；工作台据此进入只读浏览模式。 */
  isReadOnly?: boolean;
}

/**
 * 从 AppShell 唯一选择状态和最新学期列表派生只读语义。
 * 不将归档标识复制进 reducer，避免学期列表刷新后出现陈旧的写权限判断。
 */
export function deriveAcademicContext(
  context: Pick<SemesterCourseContext, "semesterId" | "courseId">,
  semesters: Semester[],
): SemesterCourseContext {
  const semester = semesters.find((item) => item.id === context.semesterId);
  return { ...context, isReadOnly: semester?.status === "archived" };
}

/** 归档学期仅允许浏览；统一写操作守卫据此拦截标记过的写入口。 */
export function isAcademicWriteBlocked(context: SemesterCourseContext): boolean {
  return context.isReadOnly === true;
}

/** 学期列表的受控加载状态。 */
export type SemesterLoadState = "idle" | "loading" | "ready" | "error";

/** 单个学期的课程列表受控加载状态。 */
export interface CourseLoadState {
  status: SemesterLoadState;
  courses: CourseInstance[];
}

/** 学期树的纯 UI 状态；AppShell 是该状态的唯一持有者。 */
export interface SemesterCourseState {
  context: SemesterCourseContext;
  expandedSemesterIds: string[];
}

/** 学期树允许的最小状态变更。 */
export type SemesterCourseAction =
  | { type: "toggleSemester"; semesterId: string }
  | { type: "selectCourse"; semesterId: string; courseId: string };

/** 创建未选择任何学习上下文的初始树状态。 */
export function createInitialSemesterCourseState(): SemesterCourseState {
  return { context: {}, expandedSemesterIds: [] };
}

/**
 * 更新学期树状态。
 * 展开新学期时清除旧课程，避免标题将课程错误地绑定到另一学期；
 * 收起学期仅影响可视树，保留当前课程上下文以便切换工作台或设置页后恢复。
 */
export function semesterCourseReducer(state: SemesterCourseState, action: SemesterCourseAction): SemesterCourseState {
  switch (action.type) {
    case "toggleSemester": {
      const isExpanded = state.expandedSemesterIds.includes(action.semesterId);
      if (isExpanded) {
        return {
          ...state,
          expandedSemesterIds: state.expandedSemesterIds.filter((id) => id !== action.semesterId),
        };
      }
      return {
        context: { semesterId: action.semesterId, courseId: undefined },
        expandedSemesterIds: [...state.expandedSemesterIds, action.semesterId],
      };
    }
    case "selectCourse":
      return {
        ...state,
        context: { semesterId: action.semesterId, courseId: action.courseId },
      };
  }
}

/** 课程请求令牌，保证最后一次展开的学期拥有写入课程状态的资格。 */
export interface SemesterCourseRequestToken {
  semesterId: string;
  requestId: number;
}

/**
 * 管理课程请求的新旧关系。
 * 请求资格按 semesterId 隔离：同一学期的新请求淘汰旧请求，多个已展开学期的读取可并行完成。
 * AppShell 卸载时调用 invalidate，使尚未完成的 Promise 无法再写入 React 状态。
 */
export class SemesterCourseRequestGate {
  private nextRequestId = 0;
  private latestRequestIdBySemester = new Map<string, number>();

  /** 开始一次课程读取并返回与该读取绑定的令牌。 */
  begin(semesterId: string): SemesterCourseRequestToken {
    const requestId = ++this.nextRequestId;
    this.latestRequestIdBySemester.set(semesterId, requestId);
    return { semesterId, requestId };
  }

  /** 仅同一学期的最后一次请求令牌可以应用读取结果。 */
  isCurrent(token: SemesterCourseRequestToken): boolean {
    return token.requestId === this.latestRequestIdBySemester.get(token.semesterId);
  }

  /** 使所有既有令牌立即过期，用于组件卸载清理。 */
  invalidate(): void {
    this.latestRequestIdBySemester.clear();
  }
}

/**
 * 将课程读取结果写入对应学期；过期或卸载后的令牌保持原状态不变。
 * 该纯函数让异步回调的竞态规则可在无 DOM 的单元测试中验证。
 */
export function applyCourseLoadResult(
  courseStates: Record<string, CourseLoadState>,
  gate: SemesterCourseRequestGate,
  token: SemesterCourseRequestToken,
  result: CourseLoadState,
): Record<string, CourseLoadState> {
  if (!gate.isCurrent(token)) return courseStates;
  return { ...courseStates, [token.semesterId]: result };
}

/** 从已有的 RPC 契约读取全部学期，不传递未定义参数。 */
export async function loadSemesters(rpc: TypedRpcClient): Promise<Semester[]> {
  return rpc.call("semesters.list", {});
}

/** 从已有的 RPC 契约读取某个学期的课程，参数必须严格绑定 semesterId。 */
export async function loadCoursesForSemester(rpc: TypedRpcClient, semesterId: string): Promise<CourseInstance[]> {
  return rpc.call("courses.list", { semesterId });
}

/** 学期状态的固定中文展示，归档状态明确为只读。 */
export function semesterStatusText(status: Semester["status"]): string {
  switch (status) {
    case "active":
      return "进行中";
    case "teaching_ended":
      return "教学结束";
    case "follow_up":
      return "跟进中";
    case "archived":
      return "已归档（只读）";
  }
}

/**
 * 清理可能含敏感内部值的展示文本。
 * 名称字段正常情况下是学生可见名称；若异常地是 UUID、绝对路径、Bearer 或堆栈痕迹，使用固定回退文案。
 */
export function safeAcademicDisplayText(value: string | undefined, fallback: string): string {
  const text = value?.trim() ?? "";
  // UUID 版本可能持续演进，按完整 canonical 形态拦截，避免仅覆盖 v1-v5。
  const containsUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text);
  // 路径可能嵌入错误消息；覆盖盘符、UNC、file URI 和 Unix 绝对路径。
  const containsAbsolutePath =
    /(?:^|[\s"'（(：:])(?:[a-z]:[\\/]|\\\\)/i.test(text) ||
    /\bfile:(?:\/{1,3})?/i.test(text) ||
    /(?:^|[\s"'（(：:])\/(?:[^\s/]+(?:\/|$))/.test(text);
  // Bearer 的分隔符并不可靠；调用栈则以异常标题或换行后的 at 帧识别，避免误伤普通课程名称。
  const containsSensitiveMarker =
    /\bbearer\b/i.test(text) ||
    /(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(text) ||
    /(?:^|\n)\s*at\s+\S+/m.test(text);
  if (!text || containsUuid || containsAbsolutePath || containsSensitiveMarker) return fallback;
  return text.slice(0, 80);
}

/** 由当前 ID 上下文解析标题栏；从不把内部 ID、路径或原始异常直接写入 UI。 */
export function formatAcademicTitle(
  context: SemesterCourseContext,
  semesters: Semester[],
  coursesBySemester: Record<string, CourseInstance[]>,
): string {
  const semester = semesters.find((item) => item.id === context.semesterId);
  const semesterName = safeAcademicDisplayText(semester?.label, "未选择学期");
  const courses = context.semesterId ? coursesBySemester[context.semesterId] ?? [] : [];
  const course = courses.find((item) => item.id === context.courseId);
  const courseName = safeAcademicDisplayText(course?.courseName, "未选择课程");
  return `${semesterName} / ${courseName}`;
}

/** 固定中文错误文案，不接受或输出 RPC 原始错误。 */
export function academicLoadErrorText(target: "semesters" | "courses"): string {
  return target === "semesters" ? "暂时无法加载学期，请稍后重试。" : "暂时无法加载课程，请切换学期后重试。";
}

/**
 * T-M5-003：对话/会话闭环固定错误文案与纯函数（REFACTOR 收敛）
 *
 * AGENTS.md §9.3：错误必须固定中文可操作文案，不泄漏 RPC 原始 message/路径/栈。
 * 会话/模型/错题/文件/发送的失败文案集中于此，供 ChatTab/AppShell 复用；
 * 发送错误映射只依据错误码，绝不透传原始 message。
 */
export const CHAT_ERRORS = {
  sessionsLoad: "会话读取失败，请重试",
  sessionsRefresh: "会话列表刷新失败，请重试",
  modelListLoad: "模型列表读取失败，请重试",
  modelConfigLoad: "模型配置读取失败，请重试",
  modelConfigSave: "模型保存失败，请重试",
  sendNoSession: "请先新建会话再发送",
  sendModelNotConfigured: "模型未配置，请先在设置页配置可用模型后重试",
  sendFailed: "发送失败，请重试",
  mistakesNoCourse: "请先选择课程，再关联错题",
  mistakesLoad: "错题列表读取失败，请重试",
  materialsLoad: "资料列表读取失败，请重试",
  renameFailed: "重命名失败，请重试",
  deleteFailed: "删除失败，请重试",
  exportFailed: "导出失败，请重试",
} as const;

/** 发送失败映射为固定中文文案（只依据错误码，不泄漏原始错误） */
export function toFixedSendError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === "MODEL_NOT_CONFIGURED") return CHAT_ERRORS.sendModelNotConfigured;
  return CHAT_ERRORS.sendFailed;
}

/** 学习场景元数据构建（09-UI §4.2；无选中项不写入字段） */
export function buildSessionMeta(
  subject: string,
  goal: string,
  mistakeIds: string[],
): { subject?: string; goal?: string; mistakeIds?: string[] } {
  return {
    ...(subject ? { subject } : {}),
    ...(goal ? { goal } : {}),
    ...(mistakeIds.length ? { mistakeIds } : {}),
  };
}

/**
 * 生产 agent.send 模型配置错误。
 *
 * 只返回可操作的固定文案；不得暴露 provider、base URL、密钥或底层初始化详情。
 */
export const MODEL_NOT_CONFIGURED = {
  code: "MODEL_NOT_CONFIGURED",
  message: "尚未配置可用 AI 模型，请先在设置中完成模型配置",
} as const;

export function modelNotConfiguredError(): typeof MODEL_NOT_CONFIGURED {
  // 纯对象可被 MessagePort structured clone 保留 code；不要抛 Error 子类（自定义属性会丢失）。
  return { ...MODEL_NOT_CONFIGURED };
}

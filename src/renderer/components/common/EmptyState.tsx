/**
 * EmptyState 空状态提示（T-M1-009 公共组件）
 *
 * 09-UI：无数据时统一空状态展示
 */
import React from "react";

interface Props {
  /** 空状态消息，无则默认"暂无数据" */
  message?: string;
}

export function EmptyState({ message }: Props): React.JSX.Element {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        color: "var(--text-muted, #888)",
        fontSize: 13,
      }}
    >
      {message ?? "暂无数据"}
    </div>
  );
}

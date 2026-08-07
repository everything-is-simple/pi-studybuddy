/**
 * LoadingState 加载中提示（T-M1-009 公共组件）
 *
 * 09-UI：数据加载中统一提示
 */
import React from "react";

interface Props {
  /** 加载提示，无则默认"加载中…" */
  message?: string;
}

export function LoadingState({ message }: Props): React.JSX.Element {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        color: "var(--text-muted, #888)",
        fontSize: 13,
      }}
    >
      {message ?? "加载中…"}
    </div>
  );
}

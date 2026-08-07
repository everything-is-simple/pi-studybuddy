/**
 * ErrorState 错误提示（T-M1-009 公共组件）
 *
 * 09-UI §7.2 隐私边界：错误消息只显示中文可操作消息，
 * 不含内部栈/SQL/路径/UUID（由调用方保证传入脱敏消息）。
 */
import React from "react";

interface Props {
  /** 中文可操作错误消息（已脱敏，不含内部栈） */
  message: string;
}

export function ErrorState({ message }: Props): React.JSX.Element {
  return (
    <div
      style={{
        padding: "16px",
        color: "#c62828",
        background: "#ffebee",
        border: "1px solid #ffcdd2",
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

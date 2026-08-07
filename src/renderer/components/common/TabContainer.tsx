/**
 * TabContainer Tab 内容容器（T-M1-009 公共组件）
 *
 * 09-UI：统一 Tab 内容区 padding/滚动
 */
import React from "react";

interface Props {
  children?: React.ReactNode;
}

export function TabContainer({ children }: Props): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: 16,
        fontSize: 13,
        color: "var(--text, #222)",
      }}
    >
      {children}
    </div>
  );
}

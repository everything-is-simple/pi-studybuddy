/**
 * ShortId 短 ID 显示（T-M1-009 公共组件）
 *
 * 09-UI §11.1 铁律：不展示完整 UUID。
 * 只显示前 8 位 + "…"，避免泄露内部唯一标识。
 */
import React from "react";

interface Props {
  /** 完整 ID（UUID 或其他） */
  id: string;
}

export function ShortId({ id }: Props): React.JSX.Element {
  const display = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  return <span title="短 ID（不展示完整标识）">{display}</span>;
}

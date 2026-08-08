/**
 * T-M3-003 L3 承载层 bigram 分词器（05-ERD §4.3）
 *
 * CJK 切 bigram + ASCII 整词小写（纯函数，无外部依赖）：
 *   - "学习计划" → ["学习", "习计", "计划"]
 *   - "practice" → ["practice"]
 *   - 完整 UUID 不产出 token（AGENTS.md §9.3 + UUID 泄漏基线）
 */

/** 完整 UUID 正则（索引/检索两侧统一过滤） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 文本中嵌入的完整 UUID 子串（分词前整体剥离，含边界） */
const UUID_IN_TEXT_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** CJK 统一表意文字区间（含扩展 A 常用区） */
function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // 基本区
    (code >= 0x3400 && code <= 0x4dbf) || // 扩展 A
    (code >= 0xf900 && code <= 0xfaff) // 兼容表意
  );
}

function isAsciiWordChar(ch: string): boolean {
  return /[a-zA-Z0-9]/.test(ch);
}

/**
 * 对一段连续 CJK 文本切 bigram。
 * "学习计划" → ["学习", "习计", "计划"]；长度不足 2 无输出。
 */
function bigramCjk(segment: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i + 1 < segment.length; i++) {
    tokens.push(segment.slice(i, i + 2));
  }
  return tokens;
}

/**
 * 分词主入口：CJK 段切 bigram，ASCII 段整词小写。
 * 完整 UUID 整体不产出 token（UUID 内部字符不可作为普通词索引）。
 */
export function tokenizeBigram(text: string): string[] {
  if (!text) return [];

  // 完整 UUID 子串整体剥离（不索引 UUID 组成部分）
  const sanitized = text.replace(UUID_IN_TEXT_RE, "");

  const tokens: string[] = [];
  let cjkBuf = "";
  let asciiBuf = "";

  const flushCjk = () => {
    if (cjkBuf) {
      tokens.push(...bigramCjk(cjkBuf));
      cjkBuf = "";
    }
  };
  const flushAscii = () => {
    if (asciiBuf) {
      const word = asciiBuf.toLowerCase();
      // 完整 UUID 不索引；其余 ASCII 词整词收录
      if (!UUID_RE.test(word)) {
        tokens.push(word);
      }
      asciiBuf = "";
    }
  };

  for (const ch of sanitized) {
    if (isCjk(ch)) {
      flushAscii();
      cjkBuf += ch;
    } else if (isAsciiWordChar(ch)) {
      flushCjk();
      asciiBuf += ch;
    } else {
      // 标点/空白/其他字符：分隔符
      flushCjk();
      flushAscii();
    }
  }
  flushCjk();
  flushAscii();

  return tokens;
}

/**
 * 构造 FTS5 OR-combined MATCH 查询。
 * ["学习","习计","计划"] → `"学习" OR "习计" OR "计划"`；空输入返回空串。
 */
export function buildMatchQuery(tokens: string[]): string {
  if (!tokens.length) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

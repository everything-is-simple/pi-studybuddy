#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
T-M1-005 OCR venv Adapter —— Python 桥（03-Arch §3.3 OCR venv Adapter 契约）

stdin/stdout JSON 协议：
    输入：{"imagePath": "<绝对路径>"}
    输出：{"text": "<识别文本>"}          成功（exit 0）
          {"error": "<固定文案>"}         失败（exit 非 0）

契约（03-Arch §3.3）：
    - 复用 OCR venv 的 python.exe（H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe）
    - onnxruntime/PIL 原生支持全图片格式（jpg/jpeg/png/webp/gif/bmp/tiff）
    - 手写 OCR 走本地 RapidOCR（不走多模态 AI，02-PRD §4.1）
    - 错误文案固定，不泄漏 imagePath/stdout/stderr/密钥

外部可调用入口 run_ocr(image_path) -> str（供 pytest 单件测试直接断言，08-Test §3.3.3）。
"""
import json
import sys
import traceback


def run_ocr(image_path: str) -> str:
    """
    本地 RapidOCR 识别图片，返回识别文本（拼接所有检测框文本）。

    :param image_path: 图片文件绝对路径
    :return: 识别出的纯文本（可能为空字符串）
    """
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR

    engine = RapidOCR()
    result, _ = engine(image_path)
    if not result:
        return ""
    # RapidOCR result: list of [box, text, score]
    lines = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            text = item[1]
            if isinstance(text, str) and text.strip():
                lines.append(text.strip())
    return "\n".join(lines)


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"error": "OCR 输入为空"}, ensure_ascii=False))
            return 1
        payload = json.loads(raw)
        image_path = payload.get("imagePath")
        if not image_path or not isinstance(image_path, str) or not image_path.strip():
            print(json.dumps({"error": "OCR 缺少图片路径"}, ensure_ascii=False))
            return 1
        text = run_ocr(image_path)
        print(json.dumps({"text": text}, ensure_ascii=False))
        return 0
    except Exception:
        # 固定文案，不泄漏路径/异常详情（03-Arch §3.3 契约）
        print(json.dumps({"error": "OCR 识别失败，请检查图片文件是否完整"}, ensure_ascii=False))
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
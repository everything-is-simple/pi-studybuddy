#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
T-M1-006 WPS COM 桥（03-Arch §3.3 WPS COM 桥契约）

旧版 doc/ppt/xls → 新版 docx/pptx/xlsx 中间格式转换，复用 OCR venv 的 Python 运行时
（H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe），pywin32 经 WPS COM 打开并"另存为"新格式。

调用方式（03-Arch §3.3）：
    主进程（Node）：child_process.spawn(python, [wps_bridge.py, ...args])
    pytest：run_wps_bridge(["convert", "--in", "...", "--out", "..."])

输入（两种方式择一）：
    1. CLI 参数：
        convert --in <源文件绝对路径> --out <输出目录绝对路径>
        ping
    2. stdin/stdout JSON 协议（03-Arch §3.3）：
        {"action":"convert","inPath":"<绝对路径>","outDir":"<绝对输出目录>"}

输出（stdout，严格 JSON，无额外污染）：
    {"status":"ok","outPath":"<新文件绝对路径>","outFileName":"test.docx"}   （exit 0）
    {"status":"error","error":"<固定文案>"}                                    （exit 非 0）

契约：
    - 按输入扩展名选 WPS ProgID：doc→KWPS.Application / ppt→KWPP.Application / xls→KET.Application
    - 子进程隔离 WPS 崩溃不影响主进程（退出码非 0）
    - 错误文案固定，不泄漏路径/stdout/stderr/密钥

外部可调用入口 run_wps_bridge(args) -> dict（供 Node/pytest 直接调用，08-Test §3.3.1）。
"""
import json
import os
import sys
import traceback


# 扩展名 → (WPS ProgID, 另存为格式常量, 新扩展名)
# 格式常量：
#   KWPS(Word)：wdFormatXMLDocument = 12 (docx)
#   KWPP(PowerPoint)：ppSaveAsOpenXMLPresentation = 24 (pptx)
#   KET(Excel)：xlOpenXMLWorkbook = 51 (xlsx)
_FORMAT_MAP = {
    "doc": {"progid": "KWPS.Application", "save_format": 12, "out_ext": "docx"},
    "ppt": {"progid": "KWPP.Application", "save_format": 24, "out_ext": "pptx"},
    "xls": {"progid": "KET.Application", "save_format": 51, "out_ext": "xlsx"},
}

# 固定错误文案（03-Arch §3.3，不泄漏路径/stdout/stderr/密钥）
MSG_CONVERT_FAILED = "旧版办公文件转换失败，请检查文件是否完整或已损坏"
MSG_UNSUPPORTED = "不支持的旧版文件格式，仅支持 doc/ppt/xls"


def _convert_one(src_path: str, out_dir: str) -> dict:
    """用 WPS COM 将单个旧版文件另存为新格式，返回归一化结果。"""
    import win32com.client

    fmt = os.path.splitext(src_path)[1].lstrip(".").lower()
    if fmt not in _FORMAT_MAP:
        raise ValueError(MSG_UNSUPPORTED)

    spec = _FORMAT_MAP[fmt]
    out_name = os.path.basename(src_path)[: -len(fmt)] + spec["out_ext"]
    out_path = os.path.join(out_dir, out_name)

    app = win32com.client.Dispatch(spec["progid"])
    try:
        # KWPP(PowerPoint) 不支持 Visible 属性，仅 doc/xls 设置（KWPP 会抛 com_error）
        if fmt != "ppt":
            app.Visible = False
        if fmt == "doc":
            doc = app.Documents.Open(src_path)
            try:
                doc.SaveAs(out_path, FileFormat=spec["save_format"])
            finally:
                doc.Close(False)
        elif fmt == "ppt":
            pres = app.Presentations.Open(src_path)
            try:
                pres.SaveAs(out_path, spec["save_format"])
            finally:
                pres.Close()
        elif fmt == "xls":
            wb = app.Workbooks.Open(src_path)
            try:
                wb.SaveAs(out_path, spec["save_format"])
            finally:
                wb.Close(False)
    finally:
        try:
            app.Quit()
        except Exception:
            pass  # KWPP(PowerPoint) 无 Quit 方法

    if not os.path.exists(out_path):
        raise ValueError(MSG_CONVERT_FAILED)
    return {"status": "ok", "outPath": out_path, "outFileName": out_name}


def run_wps_bridge(args: list) -> dict:
    """
    外部可调用入口：解析 CLI 参数并执行，返回结果 dict（供 pytest 直接断言，08-Test §3.3.1）。
    """
    action = args[0] if args else ""
    if action == "ping":
        return {"status": "ok"}
    if action == "convert":
        in_path, out_dir = None, None
        i = 1
        while i < len(args):
            if args[i] == "--in" and i + 1 < len(args):
                in_path = args[i + 1]
                i += 2
            elif args[i] == "--out" and i + 1 < len(args):
                out_dir = args[i + 1]
                i += 2
            else:
                i += 1
        if not in_path or not out_dir:
            raise ValueError(MSG_CONVERT_FAILED)
        return _convert_one(in_path, out_dir)
    raise ValueError(MSG_UNSUPPORTED)


def main() -> int:
    status = {
        "ok": 0,
        "error": 1,
    }
    try:
        # 优先读取 stdin JSON（Node 契约），否则回退 CLI 参数（pytest 契约）
        raw = sys.stdin.read()
        if raw.strip():
            payload = json.loads(raw)
            action = payload.get("action")
            if action == "ping":
                print(json.dumps({"status": "ok"}, ensure_ascii=False))
                return status["ok"]
            if action == "convert":
                result = _convert_one(payload.get("inPath", ""), payload.get("outDir", ""))
                print(json.dumps(result, ensure_ascii=False))
                return status["ok"]
            print(json.dumps({"status": "error", "error": MSG_UNSUPPORTED}, ensure_ascii=False))
            return status["error"]
        # CLI 参数路径
        result = run_wps_bridge(sys.argv[1:])
        print(json.dumps(result, ensure_ascii=False))
        return status["ok"]
    except Exception:
        # 固定文案，不泄漏路径/stdout/stderr/密钥（03-Arch §3.3）
        print(json.dumps({"status": "error", "error": MSG_CONVERT_FAILED}, ensure_ascii=False))
        traceback.print_exc(file=sys.stderr)
        return status["error"]


if __name__ == "__main__":
    sys.exit(main())
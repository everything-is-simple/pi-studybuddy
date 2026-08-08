# -*- coding: utf-8 -*-
"""
T-M1-006 WPS COM 桥 —— pytest 单件测试（08-Test §3.3.1）

契约（03-Arch §3.3 + 08-Test §3.3.1）：
    - 主进程 Node 经 child_process.spawn 调用 Python，stdin/stdout JSON 协议
    - 子进程隔离 WPS 崩溃不影响主进程（退出码非 0 → 主进程收到错误）
    - 转换：doc→docx、ppt→pptx、xls→xlsx，再走现有管道
    - 错误固定文案，不泄漏路径/stdout/stderr/密钥

断言（08-Test §3.3.1 四类）：
    1. doc → docx 转换返回归一化 JSON，且 test.docx 存在
    2. ppt → pptx / xls → xlsx（参数化三格式）
    3. 崩溃隔离：非法输入 → 子进程退出码非 0 → 主进程收到错误
    4. JSON 协议：stdin/stdout 严格 JSON，无额外输出污染（ping）

依赖：OCR venv（pywin32 + WPS COM ProgID KWPS/KET/KWPP.Application）。
      若任一缺失则整体 skip（AGENTS.md §5.4：v0.1 mock 先于真实，本测试仅在 WPS 就绪时真实执行）。

数据隔离：临时文件写运行目录，不污染业务数据根。
"""
import json
import os
import subprocess
import sys
import tempfile

import pytest

try:
    import win32com.client  # noqa: F401

    # WPS COM ProgID 探测（03-Arch §3.3：doc→KWPS / ppt→KWPP / xls→KET）
    for _progid in ("KWPS.Application", "KET.Application", "KWPP.Application"):
        win32com.client.Dispatch(_progid)

    _DEPS_OK = True
    _IMPORT_ERROR = ""
except Exception as e:  # pragma: no cover - 依赖缺失 / WPS 未注册时整体 skip
    _DEPS_OK = False
    _IMPORT_ERROR = str(e)

pytestmark = pytest.mark.skipif(
    not _DEPS_OK,
    reason=f"WPS COM 依赖缺失（pywin32 / WPS ProgID）：{_IMPORT_ERROR}",
)

_BRIDGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wps_bridge.py")


def run_wps_bridge(args: list) -> str:
    """
    以子进程方式调用 wps_bridge.py，返回原始 stdout 文本。

    契约（08-Test §3.3.1）：
        - 子进程退出码非 0 → 抛 ChildProcessError（崩溃隔离，主进程收到错误）
        - 退出码 0 → 返回 stdout 原文（须为严格 JSON）
    """
    proc = subprocess.run(
        [sys.executable, _BRIDGE] + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    if proc.returncode != 0:
        raise ChildProcessError(f"WPS 桥子进程退出码非 0：{proc.returncode}")
    return proc.stdout


def _make_source_file(path: str, fmt: str) -> str:
    """用 WPS COM 生成一份真实旧版格式源文件（doc/ppt/xls），返回路径。"""
    progid = {"doc": "KWPS.Application", "ppt": "KWPP.Application", "xls": "KET.Application"}[fmt]
    app = win32com.client.Dispatch(progid)
    try:
        # KWPP(PowerPoint) 不支持 Visible 属性，仅 doc/xls 设置（KWPP 会抛 com_error）
        if fmt != "ppt":
            app.Visible = False
        if fmt == "doc":
            doc = None
            try:
                doc = app.Documents.Add()
                rng = doc.Content
                rng.Text = "StudyBuddy WPS 桥测试文档"
                doc.SaveAs(path, FileFormat=0)  # wdFormatDocument = 0 (doc)
            finally:
                if doc is not None:
                    doc.Close(False)
        elif fmt == "ppt":
            pres = None
            try:
                pres = app.Presentations.Add()
                slide = pres.Slides.Add(1, 1)  # ppLayoutTitle = 1
                slide.Shapes.Title.TextFrame.TextRange.Text = "StudyBuddy WPS 桥测试"
                pres.SaveAs(path, 1)  # ppSaveAsPresentation = 1 (ppt)
            finally:
                if pres is not None:
                    pres.Close()
        elif fmt == "xls":
            wb = None
            try:
                wb = app.Workbooks.Add()
                wb.Worksheets(1).Cells(1, 1).Value = "StudyBuddy WPS 桥测试"
                wb.SaveAs(path, 56)  # xlExcel8 = 56 (xls)
            finally:
                if wb is not None:
                    wb.Close(False)
    finally:
        try:
            app.Quit()
        except Exception:
            pass  # KWPP(PowerPoint) 无 Quit 方法
    return path


@pytest.mark.parametrize(
    "fmt,out_ext,progid_note",
    [
        ("doc", "docx", "KWPS"),
        ("ppt", "pptx", "KWPP"),
        ("xls", "xlsx", "KET"),
    ],
)
def test_wps_bridge_convert_returns_normalized_json(fmt, out_ext, progid_note):
    """旧格式 → 新格式 转换返回归一化 JSON，且新文件存在（08-Test §3.3.1）"""
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, f"sample.{fmt}")
        _make_source_file(src, fmt)
        out = run_wps_bridge(["convert", "--in", src, "--out", tmp])
        result = json.loads(out)
        assert result["status"] == "ok"
        out_file = os.path.join(tmp, f"sample.{out_ext}")
        assert os.path.exists(out_file)
        assert result["outFileName"] == f"sample.{out_ext}"
        # 固定文案不泄漏路径（03-Arch §3.3）
        assert progid_note not in out


def test_wps_bridge_crash_isolation():
    """WPS 崩溃不影响主进程：子进程退出码非 0 → 主进程收到错误（08-Test §3.3.1）"""
    with tempfile.TemporaryDirectory() as tmp:
        # 不存在的源文件经 WPS COM 打开必然失败 → 子进程退出码非 0 → 主进程收到错误
        missing = os.path.join(tmp, "missing.doc")
        with pytest.raises(ChildProcessError):
            run_wps_bridge(["convert", "--in", missing, "--out", tmp])


def test_wps_bridge_json_protocol():
    """stdin/stdout 严格 JSON，无额外输出污染（08-Test §3.3.1 ping）"""
    out = run_wps_bridge(["ping"])
    result = json.loads(out)  # 不抛异常即通过
    assert isinstance(result, dict)
    assert result["status"] == "ok"
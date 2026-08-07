# -*- coding: utf-8 -*-
"""
T-M1-005 OCR venv Adapter —— pytest 单件测试（08-Test §3.3.3）

断言：@pytest.mark.parametrize 7 图格式（jpg/jpeg/png/webp/gif/bmp/tiff），
      对 run_ocr 生成的合成带字图片断言返回非空字符串（真实识别）。

依赖：OCR venv（rapidocr_onnxruntime/onnxruntime/PIL）。若任一缺失则整体 skip
      （AGENTS.md §5.4：v0.1 mock 先于真实，本测试仅在 OCR venv 就绪时真实执行）。

数据隔离：临时文件写运行目录，不污染业务数据根。
"""
import os
import shutil
import tempfile
import pytest

try:
    from PIL import Image, ImageDraw, ImageFont
    import rapidocr_onnxruntime  # noqa: F401
    from ocr_bridge import run_ocr

    _DEPS_OK = True
    _IMPORT_ERROR = ""
except Exception as e:  # pragma: no cover - 依赖缺失时整体 skip
    _DEPS_OK = False
    _IMPORT_ERROR = str(e)

pytestmark = pytest.mark.skipif(
    not _DEPS_OK,
    reason=f"OCR venv 依赖缺失（rapidocr_onnxruntime/PIL）：{_IMPORT_ERROR}",
)

FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff"]

# PIL 保存格式：jpg 用 JPEG 标识（08-Test §3.3.3 7 格式参数化）
_SAVE_FORMAT = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "gif": "GIF",
    "bmp": "BMP",
    "tiff": "TIFF",
}


def _make_text_image(path: str, fmt: str) -> str:
    """生成一张高对比度带文字的图片，返回保存路径。"""
    try:
        font = ImageFont.truetype("arial.ttf", 48)
    except Exception:
        font = ImageFont.load_default()
    img = Image.new("RGB", (480, 160), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 460, 140], fill="white", outline="black", width=2)
    draw.text((40, 55), "STUDY 2026", fill="black", font=font)
    img.save(path, format=_SAVE_FORMAT[fmt])
    return path


@pytest.mark.parametrize("fmt", FORMATS)
def test_run_ocr_returns_nonempty_string(fmt: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        img_path = os.path.join(tmp, f"sample.{fmt}")
        _make_text_image(img_path, fmt)
        text = run_ocr(img_path)
        assert isinstance(text, str)
        assert text.strip() != ""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FormatConfig:
    cn_font: str = "SimSun"
    en_font: str = "Times New Roman"
    heading_size_pt: int = 16
    body_size_pt: int = 12
    line_spacing: float = 1.5
    para_before_pt: int = 0
    para_after_pt: int = 0
    first_line_indent: bool = True
    clear_background: bool = True
    page_num_position: str = "center"

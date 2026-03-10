from __future__ import annotations

from typing import Any, Dict, Literal

from pydantic import BaseModel, ConfigDict, Field


class BibliographyConfig(BaseModel):
    style: Literal["ieee", "gbt", "apa"] = "ieee"
    sources_text: str = ""

    model_config = ConfigDict(extra="forbid")


class PreviewRequest(BaseModel):
    markdown: str = ""
    bibliography: BibliographyConfig = Field(default_factory=lambda: BibliographyConfig())

    model_config = ConfigDict(extra="forbid")


class GenerateConfig(BaseModel):
    cn_font: str = "SimSun"
    en_font: str = "Times New Roman"
    heading_cn_font: str = "SimHei"
    heading_en_font: str = "Times New Roman"
    heading1_size_pt: int = 14
    heading2_size_pt: int = 14
    heading3_size_pt: int = 14
    heading4_size_pt: int = 14
    heading_line_spacing: float = 1.25
    heading_para_before_lines: float = 0.5
    heading_para_after_lines: float = 0.5
    body_size_pt: int = 12
    line_spacing: float = 1.25
    para_before_lines: float = 0
    para_after_lines: float = 0
    indent_before_chars: int = 0
    indent_after_chars: int = 0
    first_line_indent_chars: int = 2
    justify: bool = True
    clear_background: bool = True
    page_num_position: Literal["center", "right"] = "center"
    figure_max_width_cm: float = 14.0
    figure_align: Literal["left", "center", "right"] = "center"

    model_config = ConfigDict(extra="forbid")


class GenerateRequest(BaseModel):
    markdown: str
    config: Dict[str, Any] | GenerateConfig = Field(default_factory=lambda: GenerateConfig())
    bibliography: BibliographyConfig = Field(default_factory=lambda: BibliographyConfig())

    model_config = ConfigDict(extra="forbid")

    def model_post_init(self, __context: Any) -> None:
        # Allow config as plain dict; coerce into GenerateConfig for downstream typing
        if isinstance(self.config, dict):
            self.config = GenerateConfig(**self.config)

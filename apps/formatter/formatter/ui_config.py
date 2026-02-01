from __future__ import annotations

from formatter.config import BodyStyle, FormatConfig, HeadingStyle


def build_format_config(
    *,
    cn_font: str,
    en_font: str,
    heading_font: str,
    heading_size_pt: int,
    body_size_pt: int,
    line_spacing: float,
    para_before_pt: int,
    para_after_pt: int,
    first_line_indent: bool,
    justify: bool,
    clear_background: bool,
    page_num_position: str,
) -> FormatConfig:
    body_style = BodyStyle(
        cn_font=cn_font,
        en_font=en_font,
        size_pt=body_size_pt,
        line_spacing=line_spacing,
        para_before_pt=para_before_pt,
        para_after_pt=para_after_pt,
        first_line_indent=first_line_indent,
        justify=justify,
    )

    heading_sizes = [heading_size_pt, heading_size_pt - 2, heading_size_pt - 3, heading_size_pt - 4]
    heading_styles = {
        level: HeadingStyle(
            font=heading_font,
            size_pt=size,
            line_spacing=line_spacing,
            para_before_pt=max(0, para_before_pt + 6),
            para_after_pt=max(0, para_after_pt + 6),
        )
        for level, size in zip(range(1, 5), heading_sizes)
    }

    return FormatConfig(
        body_style=body_style,
        heading_styles=heading_styles,
        clear_background=clear_background,
        page_num_position=page_num_position,
    )

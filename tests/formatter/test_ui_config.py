from formatter.ui_config import build_format_config


def test_build_format_config_overrides_heading_sizes():
    config = build_format_config(
        cn_font="SimSun",
        en_font="Times New Roman",
        heading_font="SimHei",
        heading_size_pt=18,
        body_size_pt=12,
        line_spacing=1.5,
        para_before_pt=0,
        para_after_pt=0,
        first_line_indent=True,
        justify=True,
        clear_background=True,
        page_num_position="center",
    )

    assert config.body_style.cn_font == "SimSun"
    assert config.body_style.en_font == "Times New Roman"
    assert config.body_style.size_pt == 12
    assert config.heading_styles[1].font == "SimHei"
    assert config.heading_styles[1].size_pt == 18
    assert config.heading_styles[2].size_pt == 16
    assert config.heading_styles[3].size_pt == 15
    assert config.heading_styles[4].size_pt == 14

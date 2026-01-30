from formatter.latex import latex_to_omml


def test_latex_to_omml_returns_xml_string():
    omml = latex_to_omml("x^2")
    assert omml.strip().startswith("<m:oMath")

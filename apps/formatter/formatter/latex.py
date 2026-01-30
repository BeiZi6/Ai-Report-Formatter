from __future__ import annotations

from latex2mathml.converter import convert as latex_to_mathml
from mathml2omml import convert as mathml_to_omml


def latex_to_omml(latex: str) -> str:
    mathml = latex_to_mathml(latex)
    return mathml_to_omml(mathml)

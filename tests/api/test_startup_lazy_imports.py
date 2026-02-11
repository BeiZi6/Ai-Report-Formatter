def test_api_main_keeps_formatter_lazy_until_endpoint_call():
    import json
    import subprocess
    import sys
    from typing import cast

    script = """
import importlib
import json
import sys

for module_name in list(sys.modules):
    if module_name == 'apps.api.main' or module_name.startswith('formatter'):
        sys.modules.pop(module_name, None)

main = importlib.import_module('apps.api.main')
before = {
    'app_logic': 'formatter.app_logic' in sys.modules,
    'docx_builder': 'formatter.docx_builder' in sys.modules,
    'ui_config': 'formatter.ui_config' in sys.modules,
}

from fastapi.testclient import TestClient

client = TestClient(main.app)
response = client.get('/healthz')

after = {
    'app_logic': 'formatter.app_logic' in sys.modules,
    'docx_builder': 'formatter.docx_builder' in sys.modules,
    'ui_config': 'formatter.ui_config' in sys.modules,
}

print(json.dumps({'status': response.status_code, 'before': before, 'after': after}))
"""

    result = subprocess.run(
        [sys.executable, "-c", script],
        check=True,
        capture_output=True,
        text=True,
    )

    payload = cast(dict[str, object], json.loads(result.stdout.strip()))

    assert payload["status"] == 200
    assert payload["before"] == {
        "app_logic": False,
        "docx_builder": False,
        "ui_config": False,
    }
    assert payload["after"] == {
        "app_logic": False,
        "docx_builder": False,
        "ui_config": False,
    }

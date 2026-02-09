from apps.api.desktop_backend import build_server_config


def test_build_server_config_uses_desktop_defaults():
    config = build_server_config({})

    assert config == {
        "host": "127.0.0.1",
        "port": 8000,
        "log_level": "warning",
    }


def test_build_server_config_respects_environment_values():
    config = build_server_config(
        {
            "DESKTOP_API_HOST": "0.0.0.0",
            "DESKTOP_API_PORT": "9123",
            "DESKTOP_API_LOG_LEVEL": "info",
        }
    )

    assert config == {
        "host": "0.0.0.0",
        "port": 9123,
        "log_level": "info",
    }

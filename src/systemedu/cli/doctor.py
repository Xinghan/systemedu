"""Diagnostic checks for SystemEdu."""

import sys

from rich.console import Console

console = Console()


def _check(label: str, fn) -> bool:
    """Run a check and print result."""
    try:
        ok, detail = fn()
        if ok:
            console.print(f"  [green]\u2713[/green] {label}: {detail}")
        else:
            console.print(f"  [red]\u2717[/red] {label}: {detail}")
        return ok
    except Exception as e:
        console.print(f"  [red]\u2717[/red] {label}: {e}")
        return False


def _check_python_version():
    v = sys.version_info
    version_str = f"{v.major}.{v.minor}.{v.micro}"
    if v >= (3, 12):
        return True, version_str
    return False, f"{version_str} (need >= 3.12)"


def _check_config_exists():
    from systemedu.core.config import CONFIG_FILE

    if CONFIG_FILE.exists():
        return True, str(CONFIG_FILE)
    return False, f"Not found at {CONFIG_FILE}. Run: systemedu onboard"


def _check_llm_configured():
    from systemedu.core.config import load_config

    config = load_config()
    if config.llm.providers:
        names = ", ".join(config.llm.providers.keys())
        return True, f"default={config.llm.default}, providers=[{names}]"
    return False, "No providers configured. Run: systemedu onboard"


def _check_api_key():
    from systemedu.core.config import load_config

    config = load_config()
    if not config.llm.providers:
        return False, "No providers configured"
    default_name = config.llm.default
    if default_name not in config.llm.providers:
        return False, f"Default provider '{default_name}' not in providers"
    prov = config.llm.providers[default_name]
    if default_name == "ollama":
        return True, "Ollama (no key needed)"
    if prov.api_key:
        masked = f"***{prov.api_key[-4:]}" if len(prov.api_key) > 4 else "(set)"
        return True, f"{default_name}: {masked}"
    return False, f"{default_name}: API key not set"


def _check_llm_connection():
    from systemedu.core.config import load_config

    config = load_config()
    if not config.llm.providers:
        return False, "No providers configured"
    default_name = config.llm.default
    if default_name not in config.llm.providers:
        return False, f"Default provider '{default_name}' not found"
    prov = config.llm.providers[default_name]
    if not prov.api_key and default_name != "ollama":
        return False, "API key not set"

    from openai import OpenAI

    client = OpenAI(
        api_key=prov.api_key or "ollama",
        base_url=prov.base_url,
    )
    response = client.chat.completions.create(
        model=prov.model,
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=5,
    )
    return True, f"{prov.model} responded"


def _check_daemon():
    from systemedu.core.daemon import DaemonManager

    info = DaemonManager.status()
    if info["running"]:
        return True, f"PID {info['pid']}"
    return False, "Not running. Run: systemedu agent start"


def _check_gateway():
    from systemedu.core.daemon import DaemonManager

    info = DaemonManager.status()
    if not info["running"]:
        return False, "Daemon not running"

    import httpx

    try:
        resp = httpx.get(f"{info['url']}/api/status", timeout=2.0)
        if resp.status_code == 200:
            return True, info["url"]
        return False, f"HTTP {resp.status_code}"
    except Exception as e:
        return False, str(e)


def _check_database():
    from systemedu.core.config import DB_FILE

    if DB_FILE.exists():
        size_kb = DB_FILE.stat().st_size / 1024
        return True, f"{DB_FILE} ({size_kb:.1f} KB)"
    return True, f"Will be created at {DB_FILE}"


def run_doctor():
    """Run all diagnostic checks."""
    console.print("\n[bold]SystemEdu Doctor[/bold]\n")

    checks = [
        ("Python version", _check_python_version),
        ("Config file", _check_config_exists),
        ("LLM provider configured", _check_llm_configured),
        ("API key", _check_api_key),
        ("LLM connection", _check_llm_connection),
        ("Daemon", _check_daemon),
        ("Gateway", _check_gateway),
        ("Database", _check_database),
    ]

    passed = sum(_check(label, fn) for label, fn in checks)
    total = len(checks)

    console.print(f"\n  {passed}/{total} checks passed\n")

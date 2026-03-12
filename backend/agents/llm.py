"""LLM client configuration for Qwen via DashScope OpenAI-compatible API."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load .env from backend directory
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-plus"


def get_llm(
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    streaming: bool = True,
) -> ChatOpenAI:
    """Create a ChatOpenAI instance configured for Qwen via DashScope."""
    if not DASHSCOPE_API_KEY:
        raise ValueError(
            "DASHSCOPE_API_KEY not set. Add it to backend/.env"
        )
    return ChatOpenAI(
        model=model,
        api_key=DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
        temperature=temperature,
        streaming=streaming,
    )

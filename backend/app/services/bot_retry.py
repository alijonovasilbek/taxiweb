import asyncio
from typing import Any, Awaitable, Callable

from aiogram.exceptions import TelegramNetworkError


async def with_retry(
    operation: Callable[[], Awaitable[Any]],
    *,
    attempts: int = 5,
    base_delay: float = 1.5,
    label: str = "bot",
) -> Any:
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            return await operation()
        except TelegramNetworkError as error:
            last_error = error
            if attempt == attempts:
                break
            delay = base_delay * attempt
            print(f"[bot] {label} network error, retry {attempt}/{attempts} in {delay:.1f}s: {error}")
            await asyncio.sleep(delay)

    if last_error:
        raise last_error


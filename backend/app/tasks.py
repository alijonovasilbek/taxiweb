"""Fon vazifalari uchun xavfsiz `create_task`.

`asyncio.create_task()` natijasiga havola saqlanmasa, Python vazifani tugamasdan xotiradan tozalab yuborishi mumkin
(asyncio hujjatlaridagi ogohlantirish). Bu yerda vazifalar to'plamda tugaguncha saqlanadi va xatolari logga yoziladi.
KAMCHILIKLAR-ANDROID.md #21
"""
import asyncio
from collections.abc import Coroutine
from typing import Any

from app.log import log

_running: set[asyncio.Task] = set()


def spawn(coro: Coroutine[Any, Any, Any], name: str | None = None) -> asyncio.Task:
    task = asyncio.create_task(coro, name=name)
    _running.add(task)
    task.add_done_callback(_done)
    return task


def _done(task: asyncio.Task) -> None:
    _running.discard(task)
    if not task.cancelled() and task.exception() is not None:
        log.warning(f"[task] {task.get_name()}: {task.exception()!r}")

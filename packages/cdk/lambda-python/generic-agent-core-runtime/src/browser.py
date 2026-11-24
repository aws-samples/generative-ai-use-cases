"""The browser tool: one AgentCore Browser session per request, driven with Playwright.

strands-agents-tools removed its browser tool in 0.9.0 and points to driving
Playwright directly, with bedrock-agentcore's BrowserClient for the session.
Owning the session here also means it is stopped when the request ends. The
0.8 tool never stopped its AgentCore sessions (it did not keep the clients it
started), so each one stayed open until its timeout.

The session starts the first time the model uses the browser, so a request
with the browser enabled pays for nothing when the model does not use it.
"""

import asyncio
import logging
from typing import Any
from urllib.parse import urlparse

from strands import tool

logger = logging.getLogger(__name__)

BROWSER_IDENTIFIER = "aws.browser.v1"
# A safety net in case a stop is missed: the session ends by itself after this
SESSION_TIMEOUT_SECONDS = 900
NAVIGATION_TIMEOUT_MS = 30_000
ACTION_TIMEOUT_MS = 10_000
# The page text handed back to the model after each action
MAX_TEXT_LENGTH = 10_000

ACTIONS = ("navigate", "click", "type", "press", "read", "back")


def check_url(url: str | None) -> str:
    """The URL to open, or ValueError. Only web pages: no file:, javascript:, data: or the like."""
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"Only http and https URLs can be opened, not {url!r}")
    return url


class BrowserSession:
    """The AgentCore Browser session of one request, started on first use."""

    def __init__(self, region: str, client_factory=None, playwright_factory=None):
        self.region = region
        self._client_factory = client_factory or _browser_client
        self._playwright_factory = playwright_factory or _start_playwright
        self._client = None
        self._playwright = None
        self._browser = None
        self._page = None
        self._lock = asyncio.Lock()

    @property
    def started(self) -> bool:
        return self._client is not None

    async def page(self):
        async with self._lock:
            if self._page is not None and not self._page.is_closed():
                return self._page
            if self._browser is None:
                client = self._client_factory(self.region)
                await asyncio.to_thread(client.start, identifier=BROWSER_IDENTIFIER, session_timeout_seconds=SESSION_TIMEOUT_SECONDS)
                # Kept before connecting, so close() stops it even if connecting fails
                self._client = client
                logger.info(f"Started AgentCore Browser session {client.session_id}")
                url, headers = client.generate_ws_headers()
                self._playwright = await self._playwright_factory()
                self._browser = await self._playwright.chromium.connect_over_cdp(url, headers=headers)
            contexts = self._browser.contexts
            context = contexts[0] if contexts else await self._browser.new_context()
            self._page = await context.new_page()
            self._page.set_default_timeout(ACTION_TIMEOUT_MS)
            self._page.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
            return self._page

    async def close(self) -> None:
        """Stop the session. Safe to call when it never started, and more than once."""
        browser, playwright, client = self._browser, self._playwright, self._client
        self._page = self._browser = self._playwright = self._client = None
        if browser is not None:
            try:
                await browser.close()
            except Exception as e:
                logger.warning(f"Could not close the browser connection: {e}")
        if playwright is not None:
            try:
                await playwright.stop()
            except Exception as e:
                logger.warning(f"Could not stop Playwright: {e}")
        if client is not None:
            session_id = client.session_id
            try:
                await asyncio.to_thread(client.stop)
                logger.info(f"Stopped AgentCore Browser session {session_id}")
            except Exception as e:
                logger.warning(f"Could not stop the AgentCore Browser session {session_id}, it ends by itself after {SESSION_TIMEOUT_SECONDS} seconds: {e}")


def _browser_client(region: str):
    from bedrock_agentcore.tools.browser_client import BrowserClient

    return BrowserClient(region=region)


async def _start_playwright():
    from playwright.async_api import async_playwright

    return await async_playwright().start()


async def _describe(page) -> str:
    """What the model sees after an action: where the page is, and its text."""
    title = await page.title()
    text = (await page.inner_text("body")).strip()
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + f"\n[... {len(text) - MAX_TEXT_LENGTH} more characters not shown]"
    return f"URL: {page.url}\nTitle: {title}\n\n{text}"


def make_browser_tool(session: BrowserSession) -> Any:
    @tool
    async def browser(action: str, url: str | None = None, selector: str | None = None, text: str | None = None, key: str | None = None) -> str:
        """Use a web browser (Amazon Bedrock AgentCore Browser) to open pages and interact with them.

        Use it when a page has to be opened or operated, for example to read a
        page whose address you know, follow links or fill in a form. Every
        action works on the same tab and returns the page's URL, title and text.

        Args:
            action: One of "navigate" (open url), "click" (click selector), "type" (type text into selector), "press" (press key, for example "Enter"), "read" (the current page again), "back" (the previous page)
            url: The http or https URL to open, for "navigate"
            selector: A Playwright selector for "click" and "type", for example "text=Sign in" or "input[name=q]"
            text: The text to type, for "type"
            key: The key to press, for "press"

        Returns:
            The page's URL, title and text after the action, or what went wrong
        """
        if action not in ACTIONS:
            return f"Unknown action {action!r}. Use one of: {', '.join(ACTIONS)}"
        try:
            if action == "navigate":
                target = check_url(url)
            elif action in ("click", "type") and not selector:
                return f'"{action}" needs a selector'
            elif action == "press" and not key:
                return '"press" needs a key'
            page = await session.page()
            if action == "navigate":
                await page.goto(target, wait_until="domcontentloaded")
            elif action == "click":
                await page.click(selector)
                await page.wait_for_load_state("domcontentloaded")
            elif action == "type":
                await page.fill(selector, text or "")
            elif action == "press":
                await page.keyboard.press(key)
                await page.wait_for_load_state("domcontentloaded")
            elif action == "back":
                await page.go_back(wait_until="domcontentloaded")
            return await _describe(page)
        except Exception as e:
            logger.warning(f"Browser action {action} failed: {e}")
            return f"The browser action {action} failed: {e}"

    return browser

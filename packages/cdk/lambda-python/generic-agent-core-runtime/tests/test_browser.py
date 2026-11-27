"""The browser session is started only when used, and always stopped.

The AgentCore client and Playwright are replaced with fakes that record what
happened to them, so these run without AWS or a browser.
"""

import asyncio

import pytest

from src import browser
from src.browser import BrowserSession, check_url, make_browser_tool


class FakeClient:
    def __init__(self, fail_stop=False):
        self.session_id = None
        self.started_with = None
        self.stopped = False
        self.fail_stop = fail_stop

    def start(self, **kwargs):
        self.started_with = kwargs
        self.session_id = "session-1"
        return self.session_id

    def generate_ws_headers(self):
        return "wss://example", {"Authorization": "x"}

    def stop(self):
        if self.fail_stop:
            raise RuntimeError("stop failed")
        self.stopped = True


class FakeKeyboard:
    def __init__(self, page):
        self.page = page

    async def press(self, key):
        self.page.calls.append(("press", key))


class FakePage:
    def __init__(self):
        self.calls = []
        self.url = "about:blank"
        self.keyboard = FakeKeyboard(self)
        self.closed = False

    def is_closed(self):
        return self.closed

    def set_default_timeout(self, ms):
        pass

    def set_default_navigation_timeout(self, ms):
        pass

    async def goto(self, url, **kwargs):
        self.calls.append(("goto", url))
        self.url = url

    async def click(self, selector):
        self.calls.append(("click", selector))

    async def fill(self, selector, text):
        self.calls.append(("fill", selector, text))

    async def go_back(self, **kwargs):
        self.calls.append(("back",))

    async def wait_for_load_state(self, state):
        pass

    async def title(self):
        return "Example"

    async def inner_text(self, selector):
        return "x" * (browser.MAX_TEXT_LENGTH + 5)


class FakeContext:
    def __init__(self):
        self.pages = []

    async def new_page(self):
        page = FakePage()
        self.pages.append(page)
        return page


class FakeBrowser:
    def __init__(self, fail_close=False):
        self.contexts = [FakeContext()]
        self.closed = False
        self.fail_close = fail_close

    async def close(self):
        if self.fail_close:
            raise RuntimeError("close failed")
        self.closed = True


class FakeChromium:
    def __init__(self, browser, fail_connect=False):
        self.browser = browser
        self.fail_connect = fail_connect

    async def connect_over_cdp(self, url, headers):
        if self.fail_connect:
            raise RuntimeError("connect failed")
        return self.browser


class FakePlaywright:
    def __init__(self, browser, fail_connect=False):
        self.chromium = FakeChromium(browser, fail_connect)
        self.stopped = False

    async def stop(self):
        self.stopped = True


def make_session(client=None, fake_browser=None, fail_connect=False):
    client = client or FakeClient()
    fake_browser = fake_browser or FakeBrowser()
    playwright = FakePlaywright(fake_browser, fail_connect)

    async def start_playwright():
        return playwright

    session = BrowserSession("us-east-1", client_factory=lambda region: client, playwright_factory=start_playwright)
    return session, client, fake_browser, playwright


def run(coro):
    return asyncio.run(coro)


def test_nothing_starts_until_the_browser_is_used():
    session, client, _, _ = make_session()
    make_browser_tool(session)
    run(session.close())
    assert not session.started
    assert client.started_with is None
    assert not client.stopped


def test_a_used_session_is_stopped_with_a_short_timeout():
    session, client, fake_browser, playwright = make_session()
    tool = make_browser_tool(session)

    async def scenario():
        result = await tool(action="navigate", url="https://example.com/")
        await session.close()
        return result

    result = run(scenario())
    assert "URL: https://example.com/" in result
    assert "more characters not shown" in result
    assert client.started_with == {"identifier": "aws.browser.v1", "session_timeout_seconds": browser.SESSION_TIMEOUT_SECONDS}
    assert client.stopped and fake_browser.closed and playwright.stopped


def test_actions_share_one_session_and_one_tab():
    session, client, fake_browser, _ = make_session()
    tool = make_browser_tool(session)

    async def scenario():
        await tool(action="navigate", url="https://example.com/")
        await tool(action="type", selector="input[name=q]", text="genu")
        await tool(action="press", key="Enter")
        await tool(action="click", selector="text=Next")
        await tool(action="back")
        await session.close()

    run(scenario())
    pages = fake_browser.contexts[0].pages
    assert len(pages) == 1
    assert pages[0].calls == [("goto", "https://example.com/"), ("fill", "input[name=q]", "genu"), ("press", "Enter"), ("click", "text=Next"), ("back",)]


def test_the_session_is_stopped_even_when_closing_the_connection_fails():
    session, client, _, playwright = make_session(fake_browser=FakeBrowser(fail_close=True))
    tool = make_browser_tool(session)

    async def scenario():
        await tool(action="navigate", url="https://example.com/")
        await session.close()

    run(scenario())
    assert client.stopped and playwright.stopped


def test_the_session_is_stopped_when_connecting_to_it_fails():
    session, client, _, _ = make_session(fail_connect=True)
    tool = make_browser_tool(session)

    async def scenario():
        result = await tool(action="navigate", url="https://example.com/")
        await session.close()
        return result

    result = run(scenario())
    assert "failed" in result
    assert client.stopped


def test_a_failed_stop_is_not_raised():
    session, client, _, _ = make_session(client=FakeClient(fail_stop=True))
    tool = make_browser_tool(session)

    async def scenario():
        await tool(action="navigate", url="https://example.com/")
        await session.close()
        await session.close()

    run(scenario())


@pytest.mark.parametrize("url", ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "example.com", "", None])
def test_only_web_pages_are_opened(url):
    with pytest.raises(ValueError):
        check_url(url)


def test_a_refused_url_starts_no_session():
    session, client, _, _ = make_session()
    tool = make_browser_tool(session)
    result = run(tool(action="navigate", url="file:///etc/passwd"))
    assert "Only http and https" in result
    assert client.started_with is None


def test_missing_arguments_and_unknown_actions_start_no_session():
    session, client, _, _ = make_session()
    tool = make_browser_tool(session)
    assert "needs a selector" in run(tool(action="click"))
    assert "needs a key" in run(tool(action="press"))
    assert "Unknown action" in run(tool(action="screenshot"))
    assert client.started_with is None

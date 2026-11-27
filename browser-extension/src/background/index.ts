import browser from 'webextension-polyfill';
import store, { initializeWrappedStore } from '../app/store';
import { presetPrompts } from '../app/features/prompt-settings/presetPrompts';
import Browser from 'webextension-polyfill';
import { MessagePayload } from '../@types/extension-message';
import { SystemContext } from '../@types/chat';

initializeWrappedStore();

store.subscribe(() => {
  // access store state
  // const state = store.getState();
  // console.log('state', state);
});

const PROMPT_KEY = 'promptList';
// Context menu for the whole page; its items are the prompts
const PAGE_MENU_ID = 'page';
// Context menu for a screenshot of the visible part of the tab
const SCREEN_MENU_ID = 'screen';
// Long enough for the chat panel to slide out before the screenshot
const CHAT_CLOSE_WAIT_MS = 300;

let prompts: SystemContext[] = [];

browser.tabs.onUpdated.addListener(async () => {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'default',
      title: 'GenU拡張機能を開く',
      contexts: ['page'],
    });
    browser.contextMenus.create({
      id: PAGE_MENU_ID,
      title: 'このページをGenUで',
      contexts: ['page'],
    });
    browser.contextMenus.create({
      id: SCREEN_MENU_ID,
      title: 'この画面をGenUで',
      contexts: ['page'],
    });

    browser.storage.local.get(PROMPT_KEY).then((value) => {
      prompts = value[PROMPT_KEY] ?? presetPrompts;
      prompts.forEach((prompt) => {
        browser.contextMenus.create({
          id: prompt.systemContextId,
          title: prompt.systemContextTitle,
          contexts: ['selection'],
        });
        browser.contextMenus.create({
          id: `${PAGE_MENU_ID}:${prompt.systemContextId}`,
          parentId: PAGE_MENU_ID,
          title: prompt.systemContextTitle,
          contexts: ['page'],
        });
        browser.contextMenus.create({
          id: `${SCREEN_MENU_ID}:${prompt.systemContextId}`,
          parentId: SCREEN_MENU_ID,
          title: prompt.systemContextTitle,
          contexts: ['page'],
        });
      });
    });
  });
});

// The service worker is stopped while it is idle, which clears the prompts
// loaded when the menus were made, so read them again on each click
const loadPrompts = async (): Promise<SystemContext[]> => {
  const value = await browser.storage.local.get(PROMPT_KEY);
  return value[PROMPT_KEY] ?? presetPrompts;
};

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.id === undefined) {
    return;
  }
  prompts = await loadPrompts();

  // A prompt for the whole page: the content script reads the page and opens the chat
  const pagePrompt = prompts.find(
    (p) => `${PAGE_MENU_ID}:${p.systemContextId}` === info.menuItemId,
  );
  if (pagePrompt) {
    Browser.tabs.sendMessage(tab.id, {
      type: 'PAGE-CONTENT',
      systemContext: pagePrompt,
    } as MessagePayload);
    return;
  }

  // A prompt for a screenshot: close the chat so that it is not in the
  // picture, take the visible part of the tab, then open the chat with it
  const screenPrompt = prompts.find(
    (p) => `${SCREEN_MENU_ID}:${p.systemContextId}` === info.menuItemId,
  );
  if (screenPrompt) {
    await Browser.tabs.sendMessage(tab.id, { type: 'CHAT-CLOSE' } as MessagePayload);
    await new Promise((resolve) => setTimeout(resolve, CHAT_CLOSE_WAIT_MS));
    const image = await Browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 80,
    });
    Browser.tabs.sendMessage(tab.id, {
      type: 'SCREENSHOT',
      image,
      systemContext: screenPrompt,
    } as MessagePayload);
    return;
  }

  {
    // Send a message from the background to the TAB
    Browser.tabs.sendMessage(tab.id, { type: 'CHAT-OPEN' } as MessagePayload);
    Browser.tabs.sendMessage(tab.id, {
      type: 'CONTENT',
      content: info.selectionText ?? '',
    } as MessagePayload);

    const prompt = prompts.filter((p) => p.systemContextId === info.menuItemId)[0];
    if (prompt) {
      Browser.tabs.sendMessage(tab.id, {
        type: 'SYSTEM-CONTEXT',
        systemContext: prompt,
      } as MessagePayload);
    }
  }
});

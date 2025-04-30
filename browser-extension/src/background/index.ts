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

let prompts: SystemContext[] = [];

browser.tabs.onUpdated.addListener(async () => {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'default',
      title: 'GenU拡張機能を開く',
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
      });
    });
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.id !== undefined) {
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

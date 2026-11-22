/**
 * What a new chat starts with. `systemContext` names one of the user's saved
 * system prompts by its id (without the `systemContext#` prefix). The type
 * leaves room for other kinds of defaults, such as an agent.
 */
export type DefaultChat = {
  type: 'systemContext';
  id: string;
};

/** Per-user settings stored on the server. */
export type UserSettings = {
  defaultChat?: DefaultChat;
};

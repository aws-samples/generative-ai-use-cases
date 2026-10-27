/**
 * Agent System Prompt Generator
 *
 * Template for generating system prompts for AI agents using LLM.
 * Includes automatic MCP server selection based on agent description.
 */

export interface MCPServerForPrompt {
  name: string;
  description: string;
  category: string;
}

export interface BuiltInToolForPrompt {
  id: string;
  name: string;
  description: string;
}

export interface AgentPromptParams {
  name: string;
  description: string;
  availableMCPServers?: MCPServerForPrompt[];
  availableBuiltInTools?: BuiltInToolForPrompt[];
}

// Markers for parsing AI output
export const MCP_SERVERS_START_MARKER = '<SELECTED_MCP_SERVERS>';
export const MCP_SERVERS_END_MARKER = '</SELECTED_MCP_SERVERS>';
export const BUILT_IN_TOOLS_START_MARKER = '<SELECTED_BUILT_IN_TOOLS>';
export const BUILT_IN_TOOLS_END_MARKER = '</SELECTED_BUILT_IN_TOOLS>';
export const SYSTEM_PROMPT_START_MARKER = '<SYSTEM_PROMPT>';
export const SYSTEM_PROMPT_END_MARKER = '</SYSTEM_PROMPT>';

/**
 * Builds the prompt template for generating an AI agent's system prompt.
 * The AI will also select appropriate MCP servers based on the agent's purpose.
 *
 * @param params - Agent information including name, description, and available MCP servers
 * @returns The formatted prompt string to send to the LLM
 */
export const buildAgentSystemPromptGeneratorPrompt = (
  params: AgentPromptParams
): string => {
  const { name, description, availableMCPServers, availableBuiltInTools } =
    params;

  const hasBuiltInTools =
    !!availableBuiltInTools && availableBuiltInTools.length > 0;

  const mcpServersSection =
    availableMCPServers && availableMCPServers.length > 0
      ? `
## Available MCP Servers (Tools)
Select the most appropriate servers for this agent based on its purpose.
${availableMCPServers.map((s) => `- ${s.name} [${s.category}]: ${s.description}`).join('\n')}
`
      : '';

  const builtInToolsSection = hasBuiltInTools
    ? `
## Available Built-in Tools
These tools are provided by the platform. Select the ones that this agent needs.
${availableBuiltInTools.map((t) => `- ${t.id} (${t.name}): ${t.description}`).join('\n')}
`
    : '';

  const builtInToolsOutputInstructions = hasBuiltInTools
    ? `Output the selected built-in tool ids (one per line) between ${BUILT_IN_TOOLS_START_MARKER} and ${BUILT_IN_TOOLS_END_MARKER} tags.
`
    : '';

  const builtInToolsRequirements = hasBuiltInTools
    ? `
- Select ONLY the built-in tools that are required by the agent's purpose (can be zero or more). Prefer a built-in tool over an MCP server when both can achieve the same thing.`
    : '';

  const mcpOutputInstructions =
    availableMCPServers && availableMCPServers.length > 0
      ? `First, output the selected MCP server names (one per line) between ${MCP_SERVERS_START_MARKER} and ${MCP_SERVERS_END_MARKER} tags.
Then, output the system prompt between ${SYSTEM_PROMPT_START_MARKER} and ${SYSTEM_PROMPT_END_MARKER} tags.`
      : `Output the system prompt between ${SYSTEM_PROMPT_START_MARKER} and ${SYSTEM_PROMPT_END_MARKER} tags.`;

  const mcpRequirements =
    availableMCPServers && availableMCPServers.length > 0
      ? `
3. Select ONLY the MCP servers that are relevant to the agent's purpose (can be zero or more)
4. In the system prompt, describe how to effectively utilize the selected tools`
      : '';

  return `You are an expert in creating system prompts for AI agents.
Based on the following information, generate an optimal system prompt for this agent.

## Agent Information
- Name: ${name}
- Description: ${description}
${mcpServersSection}${builtInToolsSection}
## Requirements
1. Clearly define the role and purpose of the agent
2. Describe the personality and behavior the agent should have${mcpRequirements}${builtInToolsRequirements}
5. Include guidelines for interaction with users
6. List any constraints or important notes
7. Write the system prompt in the same language as the Name and Description provided above

## Output Format
${builtInToolsOutputInstructions}${mcpOutputInstructions}

Example output format:
${
  hasBuiltInTools
    ? `${BUILT_IN_TOOLS_START_MARKER}
built-in-tool-id-1
${BUILT_IN_TOOLS_END_MARKER}

`
    : ''
}${
    availableMCPServers && availableMCPServers.length > 0
      ? `${MCP_SERVERS_START_MARKER}
server-name-1
server-name-2
${MCP_SERVERS_END_MARKER}

`
      : ''
  }${SYSTEM_PROMPT_START_MARKER}
Your system prompt content here...
${SYSTEM_PROMPT_END_MARKER}

Output only the formatted response. No additional explanations.`;
};

/**
 * Formats MCP server information for inclusion in the prompt.
 *
 * @param servers - Array of server objects with name and description
 * @returns Formatted string of MCP server information
 */
export const formatMCPServersInfo = (
  servers: { name: string; description: string }[]
): string => {
  return servers
    .map((server) => `- ${server.name}: ${server.description}`)
    .join('\n');
};

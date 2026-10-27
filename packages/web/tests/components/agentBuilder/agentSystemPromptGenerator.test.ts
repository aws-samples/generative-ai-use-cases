import { describe, expect, it } from 'vitest';
import {
  buildAgentSystemPromptGeneratorPrompt,
  BUILT_IN_TOOLS_START_MARKER,
  BUILT_IN_TOOLS_END_MARKER,
  MCP_SERVERS_START_MARKER,
} from '../../../src/prompts/agentSystemPromptGenerator';

const builtInTools = [
  {
    id: 'codeExecution',
    name: 'Code execution',
    description: 'Runs code and scripts.',
  },
];

const mcpServers = [
  {
    name: 'tavily-search',
    description: 'Web search powered by Tavily',
    category: 'Search',
  },
];

describe('buildAgentSystemPromptGeneratorPrompt built-in tools', () => {
  it('lists the available built-in tools', () => {
    const prompt = buildAgentSystemPromptGeneratorPrompt({
      name: 'agent',
      description: 'description',
      availableBuiltInTools: builtInTools,
    });

    expect(prompt).toContain('Available Built-in Tools');
    expect(prompt).toContain('codeExecution');
    expect(prompt).toContain('Runs code and scripts.');
  });

  it('asks for the selection between the built-in tool markers', () => {
    const prompt = buildAgentSystemPromptGeneratorPrompt({
      name: 'agent',
      description: 'description',
      availableBuiltInTools: builtInTools,
    });

    expect(prompt).toContain(BUILT_IN_TOOLS_START_MARKER);
    expect(prompt).toContain(BUILT_IN_TOOLS_END_MARKER);
  });

  it('omits the section when no built-in tool is available', () => {
    const prompt = buildAgentSystemPromptGeneratorPrompt({
      name: 'agent',
      description: 'description',
      availableMCPServers: mcpServers,
    });

    expect(prompt).not.toContain('Available Built-in Tools');
    expect(prompt).not.toContain(BUILT_IN_TOOLS_START_MARKER);
    // MCP server selection keeps working on its own
    expect(prompt).toContain(MCP_SERVERS_START_MARKER);
  });

  it('supports built-in tools and MCP servers at the same time', () => {
    const prompt = buildAgentSystemPromptGeneratorPrompt({
      name: 'agent',
      description: 'description',
      availableMCPServers: mcpServers,
      availableBuiltInTools: builtInTools,
    });

    expect(prompt).toContain('Available Built-in Tools');
    expect(prompt).toContain('Available MCP Servers');
    expect(prompt).toContain(BUILT_IN_TOOLS_START_MARKER);
    expect(prompt).toContain(MCP_SERVERS_START_MARKER);
    // The built-in tool selection is requested before the MCP servers
    expect(prompt.indexOf(BUILT_IN_TOOLS_START_MARKER)).toBeLessThan(
      prompt.lastIndexOf(MCP_SERVERS_START_MARKER)
    );
  });

  it('prefers a built-in tool over an MCP server when both fit', () => {
    const prompt = buildAgentSystemPromptGeneratorPrompt({
      name: 'agent',
      description: 'description',
      availableMCPServers: mcpServers,
      availableBuiltInTools: builtInTools,
    });

    expect(prompt).toContain('Prefer a built-in tool over an MCP server');
  });
});

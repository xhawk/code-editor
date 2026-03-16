import {code} from "./code";
import {plan} from "./plan";

export type AgentMode = 'code' | 'plan'

export interface AgentConfig {
  systemPrompt: string
  allowedTools: string[] | null // null = all tools
}

export const AGENTS: Record<AgentMode, AgentConfig> = {
  code,
  plan
}

export const DEFAULT_AGENT_MODE: AgentMode = 'code'

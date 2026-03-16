import { useState, KeyboardEvent } from 'react'
import type { AgentMode } from '../App'

interface InputProps {
  onSend: (message: string) => void
  disabled: boolean
  isLoading: boolean
  agentMode: AgentMode
  onAgentModeChange: (mode: AgentMode) => void
}

function Input({ onSend, disabled, isLoading, agentMode, onAgentModeChange }: InputProps) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="input-area">
      <div className="agent-mode-toggle">
        <button
          className={`mode-btn ${agentMode === 'code' ? 'active' : ''}`}
          onClick={() => onAgentModeChange('code')}
          title="Code mode: full tool access, implements changes"
        >
          Code
        </button>
        <button
          className={`mode-btn ${agentMode === 'plan' ? 'active' : ''}`}
          onClick={() => onAgentModeChange('plan')}
          title="Plan mode: read-only, produces structured plans"
        >
          Plan
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select a model first...' : 'Type a message... (Shift+Enter for new line)'}
        disabled={disabled}
        rows={3}
        className="message-input"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !message.trim() || isLoading}
        className="send-btn"
      >
        {isLoading ? '...' : 'Send'}
      </button>
    </div>
  )
}

export default Input

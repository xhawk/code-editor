import { useState, KeyboardEvent } from 'react'

interface InputProps {
  onSend: (message: string) => void
  disabled: boolean
  isLoading: boolean
}

function Input({ onSend, disabled, isLoading }: InputProps) {
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

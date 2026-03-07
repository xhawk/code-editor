interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function Message({ role, content, timestamp }: MessageProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`message ${role}`}>
      <div className="message-header">
        <span className="message-role">{role === 'user' ? 'You' : 'AI'}</span>
        <span className="message-time">{formatTime(timestamp)}</span>
      </div>
      <div className="message-content">
        {content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  )
}

export default Message

import Message from './Message'

interface MessageType {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatAreaProps {
  messages: MessageType[]
  isLoading: boolean
  error: string | null
}

function ChatArea({ messages, isLoading, error }: ChatAreaProps) {
  return (
    <div className="chat-area">
      {messages.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>Start a conversation with your AI model</p>
          <p className="hint">Select a model and send a message to begin</p>
        </div>
      )}
      
      {messages.map((msg, idx) => (
        <Message key={idx} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
      ))}
      
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="loading">
          <span>AI is thinking...</span>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <span>Error: {error}</span>
        </div>
      )}
    </div>
  )
}

export default ChatArea

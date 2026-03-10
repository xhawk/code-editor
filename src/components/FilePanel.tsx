import { useState, useEffect } from 'react'

interface FilePanelProps {
  filePath: string
  worktreePath?: string | null
}

function FilePanel({ filePath, worktreePath }: FilePanelProps) {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFile = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Read the file relative to the worktree or base directory
        const result = await window.electron.readFile({ relativePath: filePath })
        
        if (result.success && result.content !== undefined) {
          setContent(result.content)
        } else {
          setError(result.error || 'Failed to read file')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read file')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadFile()
  }, [filePath, worktreePath])

  if (isLoading) {
    return (
      <div className="file-panel">
        <div className="file-panel-loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="file-panel">
        <div className="file-panel-error">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="file-panel">
      <div className="file-panel-content">
        <pre>{content}</pre>
      </div>
    </div>
  )
}

export default FilePanel

import { useState, useEffect } from 'react'

interface HeaderProps {
  workingDir: string
  models: string[]
  selectedModel: string
  onModelChange: (model: string) => void
  onRefreshModels: () => void
  worktreeStatus: { created: boolean; path: string | null }
  isGitRepo: boolean
}

function Header({ workingDir, models, selectedModel, onModelChange, onRefreshModels, worktreeStatus, isGitRepo }: HeaderProps) {
  const [displayDir, setDisplayDir] = useState(workingDir)

  useEffect(() => {
    setDisplayDir(workingDir)
  }, [workingDir])

  const truncateDir = (dir: string, maxLen = 50) => {
    if (dir.length <= maxLen) return dir
    return '...' + dir.slice(-maxLen)
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="app-title">Code Editor AI</h1>
      </div>
      
      <div className="header-center">
        <span className="directory" title={displayDir}>
          {truncateDir(displayDir)}
        </span>
        {isGitRepo && (
          <span className={`worktree-status ${worktreeStatus.created ? 'active' : ''}`}>
            {worktreeStatus.created 
              ? `✓ ${worktreeStatus.path?.split('/').pop() || 'Worktree'} active` 
              : '○ No worktree'}
          </span>
        )}
        {!isGitRepo && (
          <span className="worktree-status not-git">Not a git repo</span>
        )}
      </div>
      
      <div className="header-right">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="model-select"
          disabled={models.length === 0}
        >
          {models.length === 0 ? (
            <option>No models found</option>
          ) : (
            models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))
          )}
        </select>
        <button onClick={onRefreshModels} className="refresh-btn" title="Refresh models">
          ⟳
        </button>
      </div>
    </header>
  )
}

export default Header

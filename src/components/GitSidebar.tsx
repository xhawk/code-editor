import { useState, useEffect } from 'react'

interface GitStatus {
  branch: string
  files: {
    path: string
    status: string
    indexStatus: string
    worktreeStatus: string
    type: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  }[]
}

interface GitSidebarProps {
  isGitRepo: boolean
  selectedWorktree?: string | null
  refreshKey?: number
  onOpenFile?: (filePath: string) => void
}

function GitSidebar({ isGitRepo, selectedWorktree, refreshKey, onOpenFile }: GitSidebarProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchGitStatus = async () => {
    if (!isGitRepo || !selectedWorktree) return

    setIsLoading(true)
    try {
      const status = await window.electron.getGitStatus(selectedWorktree)
      setGitStatus(status)
    } catch (err) {
      console.error('Failed to fetch git status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedWorktree) {
      setGitStatus(null)
      return
    }
    fetchGitStatus()
  }, [isGitRepo, selectedWorktree, refreshKey])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified':
        return '#f9e2af'
      case 'added':
        return 'var(--success)'
      case 'deleted':
        return 'var(--error)'
      case 'renamed':
        return 'var(--color-primary)'
      case 'untracked':
        return 'var(--text-secondary)'
      default:
        return 'var(--text-secondary)'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified':
        return 'M'
      case 'added':
        return 'A'
      case 'deleted':
        return 'D'
      case 'renamed':
        return 'R'
      case 'untracked':
        return 'U'
      default:
        return '?'
    }
  }

  const groupFilesByStatus = () => {
    if (!gitStatus) return {}
    
    const grouped: Record<string, typeof gitStatus.files> = {
      modified: [],
      added: [],
      deleted: [],
      renamed: [],
      untracked: []
    }
    
    gitStatus.files.forEach(file => {
      if (grouped[file.type]) {
        grouped[file.type].push(file)
      }
    })
    
    return grouped
  }

  const groupedFiles = groupFilesByStatus()

  const handleFileClick = (filePath: string) => {
    if (onOpenFile) {
      onOpenFile(filePath)
    }
  }

  if (!isGitRepo) {
    return (
      <div className="sidebar sidebar-right">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Git Status</h2>
        </div>
        <div className="sidebar-content">
          <p className="sidebar-empty">Not a git repository</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar sidebar-right">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Git Status</h2>
        <button
          onClick={fetchGitStatus}
          className="refresh-btn"
          disabled={isLoading}
          title="Refresh git status"
        >
          ⟳
        </button>
      </div>
      
      <div className="sidebar-content">
        {gitStatus && (
          <div className="git-branch">
            <span className="git-branch-label">Branch:</span>
            <span className="git-branch-name">{gitStatus.branch}</span>
          </div>
        )}

        {!gitStatus && !isLoading && (
          <p className="sidebar-empty">No branch selected</p>
        )}
        
        {isLoading && (
          <p className="sidebar-loading">Loading...</p>
        )}
        
        {!isLoading && gitStatus && gitStatus.files.length === 0 && (
          <p className="sidebar-empty">No changes</p>
        )}
        
        {!isLoading && gitStatus && gitStatus.files.length > 0 && (
          <div className="git-files">
            {(['modified', 'added', 'deleted', 'renamed', 'untracked'] as const).map(status => {
              const files = groupedFiles[status]
              if (!files || files.length === 0) return null
              
              return (
                <div key={status} className="git-file-group">
                  <h3 
                    className="git-file-group-title"
                    style={{ color: getStatusColor(status) }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({files.length})
                  </h3>
                  <ul className="git-file-list">
                    {files.map((file, index) => (
                      <li
                        key={`${file.path}-${index}`}
                        className="git-file-item clickable"
                        style={{ color: getStatusColor(status) }}
                        onClick={() => handleFileClick(file.path)}
                      >
                        <span className="git-file-status-icon">{getStatusIcon(status)}</span>
                        <span className="git-file-path">{file.path}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default GitSidebar

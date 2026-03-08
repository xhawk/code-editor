import { useState, useEffect } from 'react'

interface Worktree {
  path: string
  branch: string
  isMain: boolean
}

interface WorktreeListProps {
  isGitRepo: boolean
  selectedWorktree?: string | null
  onSelectWorktree: (path: string | null) => void
}

function WorktreeList({ isGitRepo, selectedWorktree, onSelectWorktree }: WorktreeListProps) {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchWorktrees = async () => {
    if (!isGitRepo) return

    setIsLoading(true)
    try {
      const result = await window.electron.getAllWorktrees()
      setWorktrees(result)
    } catch (err) {
      console.error('Failed to fetch worktrees:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorktrees()
  }, [isGitRepo])

  const shortenPath = (path: string) => {
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  if (!isGitRepo) {
    return (
      <div className="sidebar sidebar-left">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Worktrees</h2>
        </div>
        <div className="sidebar-content">
          <p className="sidebar-empty">Not a git repository</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar sidebar-left">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Worktrees</h2>
        <button
          onClick={fetchWorktrees}
          className="refresh-btn"
          disabled={isLoading}
          title="Refresh worktrees"
        >
          ⟳
        </button>
      </div>

      <div className="sidebar-content">
        {isLoading && (
          <p className="sidebar-loading">Loading...</p>
        )}

        {!isLoading && worktrees.length === 0 && (
          <p className="sidebar-empty">No worktrees found</p>
        )}

        {!isLoading && worktrees.length > 0 && (
          <ul className="git-file-list">
            {worktrees.map((worktree, index) => (
<li key={`${worktree.path}-${index}`} className="git-file-item">
              <div
                className={`worktree-item ${worktree.path === selectedWorktree ? 'selected' : ''}`}
                onClick={() => onSelectWorktree(worktree.path)}
              >
                  <div className="worktree-info">
                    <span className="worktree-branch">{worktree.branch}</span>
                    <span className="worktree-path">{shortenPath(worktree.path)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default WorktreeList

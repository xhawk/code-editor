import { ReactNode } from 'react'

export interface Tab {
  id: string
  title: string
  content: ReactNode
  closable: boolean
}

interface TabSystemProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
}

function TabSystem({ tabs, activeTabId, onTabSelect, onTabClose }: TabSystemProps) {
  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="tab-system">
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            {tab.closable && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="tab-content">
        {tabs.find(tab => tab.id === activeTabId)?.content}
      </div>
    </div>
  )
}

export default TabSystem

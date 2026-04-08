import React, { useState, useEffect } from 'react'

interface Playbook {
  id: string
  name: string
  description: string
  icon: string
  isBuiltIn: boolean
}

interface PlaybookSelectorProps {
  activePlaybookId: string
  onSelect: (playbookId: string) => void
}

const PlaybookSelector: React.FC<PlaybookSelectorProps> = ({ activePlaybookId, onSelect }) => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPlaybooks()
  }, [])

  const loadPlaybooks = async () => {
    try {
      const list = await window.electronAPI.listPlaybooks()
      setPlaybooks(list)
    } catch (error) {
      console.error('Error loading playbooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-xs text-gray-400 animate-pulse">Loading playbooks...</div>
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Playbook</div>
      <div className="grid grid-cols-3 gap-1.5">
        {playbooks.map((pb) => (
          <button
            key={pb.id}
            onClick={() => onSelect(pb.id)}
            className={`px-2 py-1.5 rounded text-[10px] transition-all text-left ${
              activePlaybookId === pb.id
                ? 'bg-purple-600/80 text-white ring-1 ring-purple-400/60'
                : 'bg-black/30 text-gray-300 hover:bg-black/50'
            }`}
            title={pb.description}
          >
            <span>{pb.icon} {pb.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PlaybookSelector

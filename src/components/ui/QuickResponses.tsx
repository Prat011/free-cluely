import React from 'react'

interface QuickResponsesProps {
  responses: string[]
  isLoading: boolean
  onCopy: (text: string) => void
}

const QuickResponses: React.FC<QuickResponsesProps> = ({ responses, isLoading, onCopy }) => {
  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Quick Responses</div>
        <div className="text-xs text-gray-400 animate-pulse bg-black/30 p-2 rounded">
          Generating suggestions...
        </div>
      </div>
    )
  }

  if (responses.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Quick Responses</div>
      <div className="space-y-1">
        {responses.map((response, i) => (
          <button
            key={i}
            onClick={() => onCopy(response)}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-300 bg-black/30 hover:bg-blue-600/30 rounded transition-all border border-transparent hover:border-blue-400/30"
            title="Click to copy"
          >
            {response}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuickResponses

// src/components/ScreenshotItem.tsx
import React from "react"
import { X } from "lucide-react"

interface Screenshot {
  path: string
  preview: string
}

interface ScreenshotItemProps {
  screenshot: Screenshot
  onDelete: (index: number) => void
  index: number
  isLoading: boolean
  selected?: boolean
  onToggleSelection?: (path: string) => void
}

const ScreenshotItem: React.FC<ScreenshotItemProps> = ({
  screenshot,
  onDelete,
  index,
  isLoading,
  selected = false,
  onToggleSelection
}) => {
  const handleDelete = async () => {
    await onDelete(index)
  }

  const handleSelect = () => {
    if (!isLoading && onToggleSelection) {
      onToggleSelection(screenshot.path)
    }
  }

  return (
    <>
      <div
        className={`relative border transition-colors ${
          selected ? "border-blue-400" : "border-white"
        } ${isLoading ? "" : "group"}`}
        onClick={handleSelect}
      >
        <div className="w-full h-full relative">
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-10 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={screenshot.preview}
            alt="Screenshot"
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isLoading
                ? "opacity-50"
                : "cursor-pointer group-hover:scale-105 group-hover:brightness-75"
            }`}
          />
          {selected && (
            <div className="absolute right-2 top-2 z-20 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">
              Selected
            </div>
          )}
        </div>
        {!isLoading && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="absolute top-2 left-2 p-1 rounded-full bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Delete screenshot"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </>
  )
}

export default ScreenshotItem

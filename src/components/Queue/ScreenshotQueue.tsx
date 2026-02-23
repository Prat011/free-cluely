import React from "react"
import ScreenshotItem from "./ScreenshotItem"

interface Screenshot {
  path: string
  preview: string
}

interface ScreenshotQueueProps {
  isLoading: boolean
  screenshots: Screenshot[]
  onDeleteScreenshot: (index: number) => void
  selectedScreenshotPaths?: string[]
  onToggleSelection?: (path: string) => void
}
const ScreenshotQueue: React.FC<ScreenshotQueueProps> = ({
  isLoading,
  screenshots,
  onDeleteScreenshot,
  selectedScreenshotPaths = [],
  onToggleSelection
}) => {
  if (screenshots.length === 0) {
    return <></>
  }

  const displayScreenshots = screenshots.slice(-5)
  const startIndex = screenshots.length - displayScreenshots.length

  return (
    <div className="grid grid-cols-5 gap-4">
      {displayScreenshots.map((screenshot, index) => (
        <ScreenshotItem
          key={screenshot.path}
          isLoading={isLoading}
          screenshot={screenshot}
          index={startIndex + index}
          onDelete={onDeleteScreenshot}
          selected={selectedScreenshotPaths.includes(screenshot.path)}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </div>
  )
}

export default ScreenshotQueue

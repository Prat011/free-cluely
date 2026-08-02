import React, { useState, useEffect } from "react"
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

const CropWindow: React.FC = () => {
  const [imgSrc, setImgSrc] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  
  useEffect(() => {
    const cleanup = window.electronAPI.onCropImage((data: { path: string; preview: string }) => {
      setImgSrc(data.preview)
    })
    
    return () => cleanup()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
          window.electronAPI.finishCrop({
            x: completedCrop.x,
            y: completedCrop.y,
            width: completedCrop.width,
            height: completedCrop.height
          })
        } else {
          window.electronAPI.finishCrop(null)
        }
      } else if (e.key === "Escape") {
        window.electronAPI.finishCrop(null)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [completedCrop])
  
  if (!imgSrc) {
    return <div className="w-screen h-screen bg-transparent"></div>
  }
  
  return (
    <div className="w-screen h-screen bg-black/50 overflow-hidden flex items-center justify-center relative select-none">
      <ReactCrop
        crop={crop}
        onChange={(_, percentCrop) => setCrop(percentCrop)}
        onComplete={(c) => setCompletedCrop(c)}
        className="w-full h-full max-w-none max-h-none flex items-center justify-center"
      >
        <img 
          src={imgSrc} 
          style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} 
          alt="Crop preview" 
          draggable={false}
        />
      </ReactCrop>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-xl pointer-events-none text-sm font-medium shadow-lg backdrop-blur-md border border-white/10">
        Draw a rectangle to crop. Press <span className="text-gray-300 font-bold">Enter</span> to confirm, <span className="text-gray-300 font-bold">Escape</span> to cancel.
      </div>
    </div>
  )
}

export default CropWindow

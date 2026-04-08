import path from "node:path"
import { v4 as uuidv4 } from "uuid"
import sharp from "sharp"

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export class RegionCropHelper {
  private outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  async cropImage(
    sourcePath: string,
    rect: CropRect,
    scaleFactor: number = 1
  ): Promise<string> {
    if (rect.x < 0 || rect.y < 0) {
      throw new Error("Crop coordinates (x, y) must be non-negative")
    }
    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error("Crop dimensions (width, height) must be positive")
    }

    const scaledRect: CropRect = {
      x: Math.round(rect.x * scaleFactor),
      y: Math.round(rect.y * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor),
    }

    const metadata = await sharp(sourcePath).metadata()
    const imgWidth = metadata.width ?? 0
    const imgHeight = metadata.height ?? 0

    if (
      scaledRect.x + scaledRect.width > imgWidth ||
      scaledRect.y + scaledRect.height > imgHeight
    ) {
      throw new Error(
        `Crop region exceeds image bounds (image: ${imgWidth}x${imgHeight}, crop: ${scaledRect.x}+${scaledRect.width}x${scaledRect.y}+${scaledRect.height})`
      )
    }

    const outputPath = path.join(this.outputDir, `region-${uuidv4()}.png`)

    await sharp(sourcePath)
      .extract({
        left: scaledRect.x,
        top: scaledRect.y,
        width: scaledRect.width,
        height: scaledRect.height,
      })
      .png()
      .toFile(outputPath)

    return outputPath
  }
}

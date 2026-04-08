import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"
import { RegionCropHelper, type CropRect } from "./RegionCropHelper"

describe("RegionCropHelper", () => {
  let tmpDir: string
  let helper: RegionCropHelper
  let testImagePath: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "region-crop-test-"))
    helper = new RegionCropHelper(tmpDir)

    // Create a test image (200x100 red rectangle)
    testImagePath = path.join(tmpDir, "test-screenshot.png")
    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toFile(testImagePath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("指定した矩形領域をクロップできる", async () => {
    const rect: CropRect = { x: 10, y: 10, width: 50, height: 30 }
    const croppedPath = await helper.cropImage(testImagePath, rect)

    expect(fs.existsSync(croppedPath)).toBe(true)

    const metadata = await sharp(croppedPath).metadata()
    expect(metadata.width).toBe(50)
    expect(metadata.height).toBe(30)
  })

  it("クロップ画像はPNG形式で保存される", async () => {
    const rect: CropRect = { x: 0, y: 0, width: 100, height: 50 }
    const croppedPath = await helper.cropImage(testImagePath, rect)

    expect(croppedPath).toMatch(/\.png$/)
    const metadata = await sharp(croppedPath).metadata()
    expect(metadata.format).toBe("png")
  })

  it("画像範囲外のrectはエラーになる", async () => {
    const rect: CropRect = { x: 0, y: 0, width: 300, height: 200 }

    await expect(helper.cropImage(testImagePath, rect)).rejects.toThrow(
      "exceeds image bounds"
    )
  })

  it("幅または高さが0以下のrectはエラーになる", async () => {
    const zeroWidth: CropRect = { x: 0, y: 0, width: 0, height: 50 }
    await expect(helper.cropImage(testImagePath, zeroWidth)).rejects.toThrow(
      "must be positive"
    )

    const negativeHeight: CropRect = { x: 0, y: 0, width: 50, height: -10 }
    await expect(
      helper.cropImage(testImagePath, negativeHeight)
    ).rejects.toThrow("must be positive")
  })

  it("x, yが負の値のrectはエラーになる", async () => {
    const negativeX: CropRect = { x: -5, y: 0, width: 50, height: 50 }
    await expect(helper.cropImage(testImagePath, negativeX)).rejects.toThrow(
      "must be non-negative"
    )
  })

  it("存在しないファイルパスはエラーになる", async () => {
    const rect: CropRect = { x: 0, y: 0, width: 50, height: 50 }
    await expect(
      helper.cropImage("/nonexistent/path.png", rect)
    ).rejects.toThrow()
  })

  it("クロップ結果は出力ディレクトリに保存される", async () => {
    const rect: CropRect = { x: 0, y: 0, width: 100, height: 50 }
    const croppedPath = await helper.cropImage(testImagePath, rect)

    expect(croppedPath.startsWith(tmpDir)).toBe(true)
  })

  it("Retina倍率に対応してrectをスケールできる", async () => {
    // Create a larger image simulating a 2x retina screenshot
    const retina2xPath = path.join(tmpDir, "retina.png")
    await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toFile(retina2xPath)

    // User selects 50x30 in screen coordinates, but actual image is 2x
    const rect: CropRect = { x: 10, y: 10, width: 50, height: 30 }
    const croppedPath = await helper.cropImage(retina2xPath, rect, 2)

    const metadata = await sharp(croppedPath).metadata()
    expect(metadata.width).toBe(100) // 50 * 2
    expect(metadata.height).toBe(60) // 30 * 2
  })
})

/**
 * Horalix Halo Backend - Document Parser Service
 *
 * Extracts text from various document types:
 * - PDF files (using pdf-parse)
 * - DOCX files (using mammoth)
 * - TXT files (raw text)
 * - Images (using Tesseract OCR)
 */

import fs from 'fs/promises'
import path from 'path'
import pdfParse = require('pdf-parse')
import mammoth from 'mammoth'
import { createWorker } from 'tesseract.js'

// ============================================================================
// DOCUMENT PARSING
// ============================================================================

export interface ParsedDocument {
  text: string
  metadata?: {
    pageCount?: number
    wordCount?: number
    language?: string
    author?: string
    title?: string
  }
}

/**
 * Parse a document and extract text content
 */
export async function parseDocument(
  filePath: string,
  mimeType: string
): Promise<ParsedDocument> {
  try {
    // Route to appropriate parser based on MIME type
    if (mimeType === 'application/pdf') {
      return await parsePDF(filePath)
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return await parseDOCX(filePath)
    } else if (mimeType.startsWith('text/')) {
      return await parseText(filePath)
    } else if (mimeType.startsWith('image/')) {
      return await parseImage(filePath)
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`)
    }
  } catch (error: any) {
    console.error('[DocumentParser] Parse error:', error)
    throw new Error(`Failed to parse document: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Parse PDF document
 */
async function parsePDF(filePath: string): Promise<ParsedDocument> {
  const dataBuffer = await fs.readFile(filePath)
  const data = await (pdfParse as any)(dataBuffer)

  return {
    text: data.text,
    metadata: {
      pageCount: data.numpages,
      wordCount: countWords(data.text),
      title: data.info?.Title || undefined,
      author: data.info?.Author || undefined,
    },
  }
}

/**
 * Parse DOCX document
 */
async function parseDOCX(filePath: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ path: filePath })

  return {
    text: result.value,
    metadata: {
      wordCount: countWords(result.value),
    },
  }
}

/**
 * Parse plain text document
 */
async function parseText(filePath: string): Promise<ParsedDocument> {
  const text = await fs.readFile(filePath, 'utf-8')

  return {
    text,
    metadata: {
      wordCount: countWords(text),
    },
  }
}

/**
 * Parse image using OCR
 */
async function parseImage(filePath: string): Promise<ParsedDocument> {
  console.log('[DocumentParser] Starting OCR for:', filePath)

  const worker = await createWorker('eng')

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(filePath)

    console.log('[DocumentParser] OCR completed with confidence:', confidence)

    return {
      text: text.trim(),
      metadata: {
        wordCount: countWords(text),
        language: 'eng',
      },
    }
  } finally {
    await worker.terminate()
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Get supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return [
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/html',
    'text/csv',

    // Images (for OCR)
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp',
  ]
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(mimeType: string): boolean {
  return getSupportedMimeTypes().includes(mimeType)
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'text/csv': 'csv',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/webp': 'webp',
  }

  return extensions[mimeType] || 'bin'
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename)

  // Replace unsafe characters
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255) // Limit length
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = path.extname(originalFilename)
  const basename = path.basename(originalFilename, ext)
  const sanitized = sanitizeFilename(basename)

  return `${timestamp}_${random}_${sanitized}${ext}`
}

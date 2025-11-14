/**
 * Horalix Halo Backend - Knowledge Documents Routes
 *
 * Custom knowledge uploads feature (Ultra tier only)
 * Allows users to upload documents that will be included in meeting context
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { requireAuth, auth } from '../middleware/auth'
import { AuthRequest } from '../types'
import KnowledgeDocumentModel from '../models/KnowledgeDocument'
import UserModel from '../models/User'
import {
  parseDocument,
  isSupportedFileType,
  generateUniqueFilename,
  getSupportedMimeTypes,
} from '../services/documentParser'
import { apiLimiter } from '../middleware/rateLimiting'

const router = express.Router()

// ============================================================================
// CONFIGURATION
// ============================================================================

const UPLOAD_DIR = path.join(__dirname, '../../uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_DOCUMENTS_PER_USER = 50
const MAX_STORAGE_PER_USER = 100 * 1024 * 1024 // 100 MB

// Create upload directory if it doesn't exist
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch((err) => {
  console.error('[Knowledge] Failed to create upload directory:', err)
})

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname)
    cb(null, uniqueFilename)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (isSupportedFileType(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
  },
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has Ultra plan
 */
function hasUltraPlan(user: any): boolean {
  return user.currentPlan === 'ultra'
}

/**
 * Check if user can upload more documents
 */
async function canUploadMore(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const count = KnowledgeDocumentModel.countByUserId(userId)

  if (count >= MAX_DOCUMENTS_PER_USER) {
    return {
      allowed: false,
      reason: `Maximum document limit reached (${MAX_DOCUMENTS_PER_USER} documents)`,
    }
  }

  const totalSize = KnowledgeDocumentModel.getTotalSizeByUserId(userId)

  if (totalSize >= MAX_STORAGE_PER_USER) {
    return {
      allowed: false,
      reason: `Storage limit reached (${Math.floor(MAX_STORAGE_PER_USER / 1024 / 1024)} MB)`,
    }
  }

  return { allowed: true }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/knowledge/upload
 * Upload a document
 * Requires Ultra plan
 */
router.post('/upload', apiLimiter, requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = req.user!

    // Check if user has Ultra plan
    if (!hasUltraPlan(user)) {
      // Delete uploaded file if exists
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {})
      }

      return res.status(403).json({
        success: false,
        error: 'Custom knowledge uploads require Ultra plan',
      })
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      })
    }

    // Check if user can upload more
    const uploadCheck = await canUploadMore(userId)
    if (!uploadCheck.allowed) {
      await fs.unlink(req.file.path).catch(() => {})

      return res.status(400).json({
        success: false,
        error: uploadCheck.reason,
      })
    }

    // Create document record
    const doc = KnowledgeDocumentModel.create({
      userId,
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
    })

    // Process document asynchronously
    processDocumentAsync(doc.id, req.file.path, req.file.mimetype)

    res.status(201).json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.originalFilename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        isProcessed: doc.isProcessed === 1,
        createdAt: doc.createdAt,
      },
    })
  } catch (error: any) {
    console.error('[Knowledge] Upload error:', error)

    // Clean up file if it was uploaded
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {})
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document',
    })
  }
})

/**
 * GET /api/knowledge/documents
 * List user's documents
 */
router.get('/documents', apiLimiter, requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = req.user!

    if (!hasUltraPlan(user)) {
      return res.status(403).json({
        success: false,
        error: 'Custom knowledge uploads require Ultra plan',
      })
    }

    const documents = KnowledgeDocumentModel.findByUserId(userId)

    const safeDocuments = documents.map((doc) => ({
      id: doc.id,
      filename: doc.originalFilename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      isProcessed: doc.isProcessed === 1,
      processingError: doc.processingError,
      wordCount: doc.extractedText ? doc.extractedText.split(/\s+/).length : 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    const stats = {
      totalDocuments: documents.length,
      processedDocuments: KnowledgeDocumentModel.countProcessedByUserId(userId),
      totalStorage: KnowledgeDocumentModel.getTotalSizeByUserId(userId),
      maxDocuments: MAX_DOCUMENTS_PER_USER,
      maxStorage: MAX_STORAGE_PER_USER,
    }

    res.json({
      success: true,
      documents: safeDocuments,
      stats,
    })
  } catch (error: any) {
    console.error('[Knowledge] List error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to list documents',
    })
  }
})

/**
 * GET /api/knowledge/documents/:id
 * Get document details
 */
router.get('/documents/:id', apiLimiter, requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const doc = KnowledgeDocumentModel.findById(id)

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      })
    }

    if (doc.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      })
    }

    const metadata = doc.metadata ? JSON.parse(doc.metadata) : null

    res.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.originalFilename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        isProcessed: doc.isProcessed === 1,
        processingError: doc.processingError,
        extractedText: doc.extractedText,
        metadata,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    })
  } catch (error: any) {
    console.error('[Knowledge] Get document error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get document',
    })
  }
})

/**
 * DELETE /api/knowledge/documents/:id
 * Delete a document
 */
router.delete('/documents/:id', apiLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const doc = KnowledgeDocumentModel.findById(id)

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      })
    }

    if (doc.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      })
    }

    // Delete file from filesystem
    try {
      await fs.unlink(doc.filePath)
    } catch (error) {
      console.warn('[Knowledge] Failed to delete file:', error)
    }

    // Delete database record
    KnowledgeDocumentModel.delete(id)

    res.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error: any) {
    console.error('[Knowledge] Delete error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
    })
  }
})

/**
 * POST /api/knowledge/search
 * Search documents
 */
router.post('/search', apiLimiter, requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = req.user!
    const { query } = req.body

    if (!hasUltraPlan(user)) {
      return res.status(403).json({
        success: false,
        error: 'Custom knowledge uploads require Ultra plan',
      })
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      })
    }

    const documents = KnowledgeDocumentModel.searchByText(userId, query)

    const results = documents.map((doc) => ({
      id: doc.id,
      filename: doc.originalFilename,
      fileType: doc.fileType,
      snippet: doc.extractedText ? doc.extractedText.substring(0, 200) + '...' : '',
      createdAt: doc.createdAt,
    }))

    res.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error: any) {
    console.error('[Knowledge] Search error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to search documents',
    })
  }
})

/**
 * GET /api/knowledge/context
 * Get all extracted text for meeting context injection
 */
router.get('/context', apiLimiter, requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = req.user!

    if (!hasUltraPlan(user)) {
      return res.status(403).json({
        success: false,
        error: 'Custom knowledge uploads require Ultra plan',
      })
    }

    const context = KnowledgeDocumentModel.getAllExtractedText(userId)
    const documents = KnowledgeDocumentModel.findProcessedByUserId(userId)

    res.json({
      success: true,
      context,
      documentCount: documents.length,
      characterCount: context.length,
    })
  } catch (error: any) {
    console.error('[Knowledge] Get context error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get context',
    })
  }
})

/**
 * GET /api/knowledge/supported-types
 * Get list of supported file types
 */
router.get('/supported-types', (req, res) => {
  res.json({
    success: true,
    mimeTypes: getSupportedMimeTypes(),
    maxFileSize: MAX_FILE_SIZE,
    maxDocuments: MAX_DOCUMENTS_PER_USER,
    maxStorage: MAX_STORAGE_PER_USER,
  })
})

// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

/**
 * Process document asynchronously
 */
async function processDocumentAsync(
  documentId: string,
  filePath: string,
  mimeType: string
): Promise<void> {
  try {
    console.log('[Knowledge] Processing document:', documentId)

    const parsed = await parseDocument(filePath, mimeType)

    KnowledgeDocumentModel.updateExtractedText(
      documentId,
      parsed.text,
      parsed.metadata
    )

    console.log('[Knowledge] Document processed successfully:', documentId)
  } catch (error: any) {
    console.error('[Knowledge] Processing error:', error)

    KnowledgeDocumentModel.markProcessingFailed(
      documentId,
      error.message || 'Processing failed'
    )
  }
}

export default router

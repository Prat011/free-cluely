/**
 * Horalix Halo Backend - License Routes
 *
 * API endpoints for license activation and management
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { LicenseModel } from '../models/License'
import { UserModel } from '../models/User'

const router = Router()

// ============================================================================
// LICENSE ACTIVATION ENDPOINTS
// ============================================================================

/**
 * POST /api/licenses/activate
 * Activate a license key for the current user
 */
router.post('/activate', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId
    const { licenseKey } = req.body

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required',
      })
    }

    // Validate license key format
    if (!licenseKey.startsWith('HORALIX-') || licenseKey.length !== 29) {
      return res.status(400).json({
        success: false,
        error: 'Invalid license key format',
      })
    }

    // Activate the license
    const license = LicenseModel.activate(licenseKey, userId)

    // Update user's plan based on license
    const user = UserModel.findById(userId)
    if (user && user.currentPlan !== license.planId) {
      UserModel.updatePlan(userId, license.planId)
    }

    res.json({
      success: true,
      message: `License activated! Your account has been upgraded to ${license.planId.toUpperCase()} plan.`,
      license: {
        id: license.id,
        planId: license.planId,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
      },
    })
  } catch (error: any) {
    console.error('License activation error:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'License activation failed',
    })
  }
})

/**
 * GET /api/licenses/my-licenses
 * Get all licenses for the current user
 */
router.get('/my-licenses', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId

    const licenses = LicenseModel.findByUserId(userId)

    res.json({
      success: true,
      licenses: licenses.map((license) => ({
        id: license.id,
        licenseKey: license.licenseKey,
        planId: license.planId,
        status: license.status,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        createdAt: license.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Get licenses error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve licenses',
    })
  }
})

/**
 * POST /api/licenses/validate
 * Validate a license key without activating it
 */
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const { licenseKey } = req.body

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required',
      })
    }

    const license = LicenseModel.findByKey(licenseKey)

    if (!license) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid license key',
      })
    }

    const isValid = LicenseModel.isValid(licenseKey)
    const canActivate =
      isValid && (!license.userId || license.userId === (req as any).userId) && license.currentActivations < license.maxActivations

    res.json({
      success: true,
      valid: isValid,
      canActivate,
      license: isValid
        ? {
            planId: license.planId,
            status: license.status,
            expiresAt: license.expiresAt,
            alreadyActivated: license.userId === (req as any).userId,
          }
        : null,
    })
  } catch (error: any) {
    console.error('License validation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate license',
    })
  }
})

// ============================================================================
// ADMIN ENDPOINTS (Protected)
// ============================================================================

/**
 * POST /api/licenses/generate
 * Generate a new license key (admin only for now)
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { planId, maxActivations, expiresInDays, metadata } = req.body

    if (!planId || !['plus', 'ultra'].includes(planId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid planId is required (plus or ultra)',
      })
    }

    const license = LicenseModel.create({
      planId,
      maxActivations: maxActivations || 1,
      expiresInDays,
      metadata,
    })

    res.json({
      success: true,
      message: 'License generated successfully',
      license: {
        id: license.id,
        licenseKey: license.licenseKey,
        planId: license.planId,
        maxActivations: license.maxActivations,
        expiresAt: license.expiresAt,
        createdAt: license.createdAt,
      },
    })
  } catch (error: any) {
    console.error('License generation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate license',
    })
  }
})

/**
 * GET /api/licenses/stats
 * Get license statistics (admin)
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = LicenseModel.getRevenueStats()

    // Calculate estimated revenue
    const estimatedMonthlyRevenue = stats.plusLicenses * 9 + stats.ultraLicenses * 19

    res.json({
      success: true,
      stats: {
        ...stats,
        estimatedMonthlyRevenue,
        estimatedAnnualRevenue: estimatedMonthlyRevenue * 12,
      },
    })
  } catch (error: any) {
    console.error('Get stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
    })
  }
})

/**
 * DELETE /api/licenses/:licenseId
 * Delete a license (admin)
 */
router.delete('/:licenseId', requireAuth, async (req, res) => {
  try {
    const { licenseId } = req.params

    const deleted = LicenseModel.delete(licenseId)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'License not found',
      })
    }

    res.json({
      success: true,
      message: 'License deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete license error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete license',
    })
  }
})

export default router

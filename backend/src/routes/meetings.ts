/**
 * Horalix Halo Backend - Meetings Routes
 *
 * Handle meeting creation, tracking, and usage stats
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import {
  getCompleteUsageStats,
  canStartMeeting,
  canStartFreeTrial,
} from '../services/usage'
import MeetingModel from '../models/Meeting'
import UserModel from '../models/User'
import {
  AuthRequest,
  UsageStatsResponse,
  CanStartMeetingRequest,
  CanStartMeetingResponse,
  ValidationError,
} from '../types'

const router = Router()

// ============================================================================
// GET /api/meetings/usage - Get usage stats for current billing period
// ============================================================================

router.get(
  '/usage',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!

    // Get comprehensive usage stats
    const stats = await getCompleteUsageStats(userId)

    const response: UsageStatsResponse = stats

    res.json(response)
  })
)

// ============================================================================
// POST /api/meetings/can-start - Check if user can start a new meeting
// ============================================================================

router.post(
  '/can-start',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const { estimatedDurationMinutes, estimatedAiCost } =
      req.body as CanStartMeetingRequest

    // Default to 30 minutes if not provided
    const duration = estimatedDurationMinutes || 30

    // Check if user can start a meeting
    const result = await canStartMeeting(userId, duration)

    const response: CanStartMeetingResponse = result

    res.json(response)
  })
)

// ============================================================================
// POST /api/meetings/start - Start a new meeting
// ============================================================================

router.post(
  '/start',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const user = req.user!

    // Check if user can start a meeting
    const canStart = await canStartMeeting(userId)
    if (!canStart.canStart) {
      throw new ValidationError(canStart.reason || 'Cannot start meeting')
    }

    // Create new meeting
    const meeting = MeetingModel.create(userId)

    // If user is on free plan, record trial start
    if (user.currentPlan === 'free') {
      UserModel.recordFreeTrialStart(userId)
    }

    res.json({
      meeting,
      message: 'Meeting started successfully',
    })
  })
)

// ============================================================================
// POST /api/meetings/:id/end - End a meeting
// ============================================================================

router.post(
  '/:id/end',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const meetingId = req.params.id

    // Get meeting
    const meeting = MeetingModel.findById(meetingId)
    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    // Verify ownership
    if (meeting.userId !== userId) {
      throw new ValidationError('You do not have permission to end this meeting')
    }

    // Check if already ended
    if (meeting.endedAt) {
      throw new ValidationError('Meeting has already ended')
    }

    // End meeting
    const endedMeeting = MeetingModel.endMeeting(meetingId)

    res.json({
      meeting: endedMeeting,
      message: 'Meeting ended successfully',
    })
  })
)

// ============================================================================
// GET /api/meetings - Get all meetings for user
// ============================================================================

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!

    // Get query parameters for pagination
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Get all meetings
    const allMeetings = MeetingModel.findAllByUserId(userId)

    // Apply pagination
    const meetings = allMeetings.slice(offset, offset + limit)

    res.json({
      meetings,
      total: allMeetings.length,
      limit,
      offset,
    })
  })
)

// ============================================================================
// GET /api/meetings/:id - Get meeting by ID
// ============================================================================

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const meetingId = req.params.id

    // Get meeting
    const meeting = MeetingModel.findById(meetingId)
    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    // Verify ownership
    if (meeting.userId !== userId) {
      throw new ValidationError('You do not have permission to view this meeting')
    }

    res.json({ meeting })
  })
)

// ============================================================================
// PUT /api/meetings/:id/transcript - Update transcript path
// ============================================================================

router.put(
  '/:id/transcript',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const meetingId = req.params.id
    const { transcriptPath } = req.body

    if (!transcriptPath) {
      throw new ValidationError('transcriptPath is required')
    }

    // Get meeting
    const meeting = MeetingModel.findById(meetingId)
    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    // Verify ownership
    if (meeting.userId !== userId) {
      throw new ValidationError('You do not have permission to update this meeting')
    }

    // Update transcript path
    const updatedMeeting = MeetingModel.updateTranscriptPath(
      meetingId,
      transcriptPath
    )

    res.json({
      meeting: updatedMeeting,
      message: 'Transcript path updated successfully',
    })
  })
)

// ============================================================================
// PUT /api/meetings/:id/recap - Update recap path
// ============================================================================

router.put(
  '/:id/recap',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const meetingId = req.params.id
    const { recapPath } = req.body

    if (!recapPath) {
      throw new ValidationError('recapPath is required')
    }

    // Get meeting
    const meeting = MeetingModel.findById(meetingId)
    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    // Verify ownership
    if (meeting.userId !== userId) {
      throw new ValidationError('You do not have permission to update this meeting')
    }

    // Update recap path
    const updatedMeeting = MeetingModel.updateRecapPath(meetingId, recapPath)

    res.json({
      meeting: updatedMeeting,
      message: 'Recap path updated successfully',
    })
  })
)

// ============================================================================
// DELETE /api/meetings/:id - Delete a meeting
// ============================================================================

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const meetingId = req.params.id

    // Get meeting
    const meeting = MeetingModel.findById(meetingId)
    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    // Verify ownership
    if (meeting.userId !== userId) {
      throw new ValidationError('You do not have permission to delete this meeting')
    }

    // Delete meeting
    MeetingModel.delete(meetingId)

    res.json({
      message: 'Meeting deleted successfully',
    })
  })
)

export default router

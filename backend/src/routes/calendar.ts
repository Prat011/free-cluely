/**
 * Horalix Halo Backend - Calendar Routes
 *
 * Handles calendar integration and event fetching
 */

import express from "express"
import { auth } from "../middleware/auth"
import { AuthRequest } from "../types"
import { GoogleCalendarService, generateMeetingContext } from "../services/googleCalendar"
import { CalendarConnectionModel } from "../models/CalendarConnection"

const router = express.Router()
const googleCalendar = new GoogleCalendarService()

// ============================================================================
// GOOGLE CALENDAR ROUTES
// ============================================================================

/**
 * GET /api/calendar/google/connect
 * Get OAuth2 authorization URL for Google Calendar
 */
router.get("/google/connect", auth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const authUrl = googleCalendar.getAuthUrl(userId)

    res.json({
      success: true,
      authUrl,
    })
  } catch (error) {
    console.error("[Calendar] Google connect error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to generate authorization URL",
    })
  }
})

/**
 * GET /api/calendar/google/callback
 * OAuth2 callback for Google Calendar
 */
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query

    if (!code || typeof code !== "string") {
      return res.status(400).send("Missing authorization code")
    }

    const userId = state as string // We passed userId in state

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresAt } =
      await googleCalendar.getTokensFromCode(code)

    // Check if connection already exists
    const existing = CalendarConnectionModel.findByUserAndProvider(userId, "google")

    if (existing) {
      // Update existing connection
      CalendarConnectionModel.updateTokens(existing.id, accessToken, refreshToken, expiresAt)
    } else {
      // Create new connection
      CalendarConnectionModel.create({
        userId,
        provider: "google",
        accessToken,
        refreshToken,
        expiresAt,
      })
    }

    // Redirect to success page
    res.send(`
      <html>
        <body>
          <h1>Calendar Connected!</h1>
          <p>Google Calendar has been successfully connected to Horalix Halo.</p>
          <p>You can close this window now.</p>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'calendar_connected', provider: 'google' }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    console.error("[Calendar] Google callback error:", error)
    res.status(500).send("Failed to connect Google Calendar")
  }
})

/**
 * GET /api/calendar/events
 * Get upcoming calendar events
 */
router.get("/events", auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { provider = "google", maxResults = "10" } = req.query

    // Get calendar connection
    const connection = CalendarConnectionModel.findByUserAndProvider(
      userId,
      provider as "google"
    )

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Calendar not connected. Please connect your calendar first.",
      })
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.accessToken
    if (CalendarConnectionModel.isTokenExpired(connection)) {
      const refreshed = await googleCalendar.refreshAccessToken(connection.refreshToken)
      accessToken = refreshed.accessToken

      CalendarConnectionModel.updateTokens(
        connection.id,
        refreshed.accessToken,
        connection.refreshToken,
        refreshed.expiresAt
      )
    }

    // Fetch events
    const events = await googleCalendar.getUpcomingEvents(accessToken, {
      maxResults: parseInt(maxResults as string, 10),
    })

    res.json({
      success: true,
      events,
      provider,
    })
  } catch (error) {
    console.error("[Calendar] Get events error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch calendar events",
    })
  }
})

/**
 * GET /api/calendar/event/:eventId
 * Get single calendar event with full context
 */
router.get("/event/:eventId", auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { eventId } = req.params
    const { provider = "google" } = req.query

    // Get calendar connection
    const connection = CalendarConnectionModel.findByUserAndProvider(
      userId,
      provider as "google"
    )

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Calendar not connected",
      })
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.accessToken
    if (CalendarConnectionModel.isTokenExpired(connection)) {
      const refreshed = await googleCalendar.refreshAccessToken(connection.refreshToken)
      accessToken = refreshed.accessToken

      CalendarConnectionModel.updateTokens(
        connection.id,
        refreshed.accessToken,
        connection.refreshToken,
        refreshed.expiresAt
      )
    }

    // Fetch event
    const event = await googleCalendar.getEvent(accessToken, eventId)

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      })
    }

    // Generate meeting context for AI
    const context = generateMeetingContext(event)

    res.json({
      success: true,
      event,
      context,
    })
  } catch (error) {
    console.error("[Calendar] Get event error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch event",
    })
  }
})

/**
 * GET /api/calendar/connections
 * Get all connected calendars for user
 */
router.get("/connections", auth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const connections = CalendarConnectionModel.findByUserId(userId)

    // Don't expose tokens
    const safeConnections = connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      isExpired: CalendarConnectionModel.isTokenExpired(conn),
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }))

    res.json({
      success: true,
      connections: safeConnections,
    })
  } catch (error) {
    console.error("[Calendar] Get connections error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch calendar connections",
    })
  }
})

/**
 * DELETE /api/calendar/connection/:provider
 * Disconnect a calendar
 */
router.delete("/connection/:provider", auth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { provider } = req.params

    const connection = CalendarConnectionModel.findByUserAndProvider(
      userId,
      provider as "google"
    )

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Calendar connection not found",
      })
    }

    CalendarConnectionModel.delete(connection.id)

    res.json({
      success: true,
      message: `${provider} calendar disconnected`,
    })
  } catch (error) {
    console.error("[Calendar] Disconnect error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to disconnect calendar",
    })
  }
})

export default router

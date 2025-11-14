/**
 * Horalix Halo - Google Calendar Integration
 *
 * Fetches upcoming meetings from Google Calendar.
 * Provides meeting context for AI assistance.
 */

import { google } from "googleapis"
import type { OAuth2Client } from "google-auth-library"

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  startTime: number
  endTime: number
  attendees: string[]
  location?: string
  meetingLink?: string
}

export interface CalendarConnection {
  userId: string
  provider: "google" | "outlook" | "apple"
  accessToken: string
  refreshToken: string
  expiresAt: number
}

// ============================================================================
// GOOGLE CALENDAR SERVICE
// ============================================================================

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client

  constructor() {
    // Initialize OAuth2 client with credentials from environment
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/calendar/google/callback"
    )
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ]

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: userId, // Pass userId in state for callback
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresAt: number
  }> {
    const { tokens } = await this.oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get tokens from authorization code")
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expiry_date || 3600 * 1000),
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    expiresAt: number
  }> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    const { credentials } = await this.oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token")
    }

    return {
      accessToken: credentials.access_token,
      expiresAt: Date.now() + (credentials.expiry_date || 3600 * 1000),
    }
  }

  /**
   * Fetch upcoming calendar events
   */
  async getUpcomingEvents(
    accessToken: string,
    options: {
      maxResults?: number
      timeMin?: Date
      timeMax?: Date
    } = {}
  ): Promise<CalendarEvent[]> {
    // Set access token
    this.oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const calendar = google.calendar({ version: "v3", auth: this.oauth2Client })

    const timeMin = options.timeMin || new Date()
    const timeMax = options.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days ahead

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: options.maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
    })

    const events = response.data.items || []

    return events.map((event): CalendarEvent => {
      const startTime = event.start?.dateTime
        ? new Date(event.start.dateTime).getTime()
        : event.start?.date
        ? new Date(event.start.date).getTime()
        : Date.now()

      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime).getTime()
        : event.end?.date
        ? new Date(event.end.date).getTime()
        : startTime + 60 * 60 * 1000 // Default 1 hour

      const attendees = (event.attendees || [])
        .map((a) => a.email || "")
        .filter(Boolean)

      return {
        id: event.id || `event_${Date.now()}`,
        summary: event.summary || "Untitled Meeting",
        description: event.description || undefined,
        startTime,
        endTime,
        attendees,
        location: event.location || undefined,
        meetingLink: event.hangoutLink || extractMeetingLink(event.description || undefined),
      }
    })
  }

  /**
   * Get single event by ID
   */
  async getEvent(accessToken: string, eventId: string): Promise<CalendarEvent | null> {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const calendar = google.calendar({ version: "v3", auth: this.oauth2Client })

    try {
      const response = await calendar.events.get({
        calendarId: "primary",
        eventId,
      })

      const event = response.data

      const startTime = event.start?.dateTime
        ? new Date(event.start.dateTime).getTime()
        : event.start?.date
        ? new Date(event.start.date).getTime()
        : Date.now()

      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime).getTime()
        : event.end?.date
        ? new Date(event.end.date).getTime()
        : startTime + 60 * 60 * 1000

      const attendees = (event.attendees || [])
        .map((a) => a.email || "")
        .filter(Boolean)

      return {
        id: event.id || `event_${Date.now()}`,
        summary: event.summary || "Untitled Meeting",
        description: event.description || undefined,
        startTime,
        endTime,
        attendees,
        location: event.location || undefined,
        meetingLink: event.hangoutLink || extractMeetingLink(event.description || undefined),
      }
    } catch (error) {
      console.error("[GoogleCalendar] Failed to get event:", error)
      return null
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract meeting link from event description
 */
function extractMeetingLink(description?: string): string | undefined {
  if (!description) return undefined

  // Common patterns for meeting links
  const patterns = [
    /https:\/\/meet\.google\.com\/[a-z-]+/i,
    /https:\/\/zoom\.us\/j\/\d+/i,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/i,
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) return match[0]
  }

  return undefined
}

/**
 * Parse meeting attendees from description
 */
export function parseAttendeesFromDescription(description?: string): string[] {
  if (!description) return []

  // Look for email patterns
  const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g
  const matches = description.match(emailPattern) || []

  return [...new Set(matches)] // Remove duplicates
}

/**
 * Generate meeting context for AI
 */
export function generateMeetingContext(event: CalendarEvent): string {
  const parts: string[] = []

  parts.push(`Meeting Title: ${event.summary}`)

  if (event.description) {
    parts.push(`Description: ${event.description}`)
  }

  if (event.attendees.length > 0) {
    parts.push(`Attendees: ${event.attendees.join(", ")}`)
  }

  if (event.location) {
    parts.push(`Location: ${event.location}`)
  }

  const duration = Math.floor((event.endTime - event.startTime) / 1000 / 60)
  parts.push(`Duration: ${duration} minutes`)

  return parts.join("\n")
}

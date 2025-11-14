/**
 * Horalix Halo - Calendar Page
 *
 * View upcoming meetings from connected calendars.
 * Get meeting context for AI assistance.
 */

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"

// ============================================================================
// TYPES
// ============================================================================

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  startTime: number
  endTime: number
  attendees: string[]
  location?: string
  meetingLink?: string
}

interface CalendarConnection {
  id: string
  provider: "google" | "outlook" | "apple"
  isExpired: boolean
  createdAt: number
  updatedAt: number
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CalendarPage: React.FC = () => {
  const [connections, setConnections] = useState<CalendarConnection[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // ============================================================================
  // LOAD DATA
  // ============================================================================

  useEffect(() => {
    loadConnections()
    loadEvents()
  }, [])

  const loadConnections = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/calendar/connections", {
        headers: {
          // TODO: Add JWT auth token
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConnections(data.connections || [])
      }
    } catch (error) {
      console.error("[CalendarPage] Failed to load connections:", error)
    }
  }

  const loadEvents = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:3001/api/calendar/events?maxResults=20", {
        headers: {
          // TODO: Add JWT auth token
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error("[CalendarPage] Failed to load events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================================================
  // CALENDAR ACTIONS
  // ============================================================================

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/calendar/google/connect", {
        headers: {
          // TODO: Add JWT auth token
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Open OAuth URL in new window
        window.open(data.authUrl, "_blank", "width=600,height=700")

        // Listen for success message
        window.addEventListener("message", (event) => {
          if (event.data.type === "calendar_connected") {
            loadConnections()
            loadEvents()
          }
        })
      }
    } catch (error) {
      console.error("[CalendarPage] Failed to connect Google Calendar:", error)
    }
  }

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider} calendar?`)) return

    try {
      const response = await fetch(
        `http://localhost:3001/api/calendar/connection/${provider}`,
        {
          method: "DELETE",
          headers: {
            // TODO: Add JWT auth token
            "Content-Type": "application/json",
          },
        }
      )

      if (response.ok) {
        loadConnections()
        setEvents([])
      }
    } catch (error) {
      console.error("[CalendarPage] Failed to disconnect calendar:", error)
    }
  }

  // ============================================================================
  // RENDER: NO CONNECTIONS
  // ============================================================================

  if (connections.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#0f0f23] p-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mb-8">
              <svg
                className="w-24 h-24 mx-auto text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h1 className="text-3xl font-bold text-white mb-2">
                Connect Your Calendar
              </h1>
              <p className="text-gray-400 max-w-xl mx-auto">
                Sync your calendar to give Horalix Halo context about upcoming meetings.
                Get better AI assistance with knowledge of who's in the meeting and what
                you'll be discussing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {/* Google Calendar */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleConnectGoogle}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-white/20 transition-all"
              >
                <div className="text-4xl mb-3">📅</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Google Calendar
                </h3>
                <p className="text-sm text-gray-400">Connect your Google Calendar</p>
              </motion.button>

              {/* Outlook Calendar */}
              <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl opacity-50 cursor-not-allowed">
                <div className="text-4xl mb-3">📧</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Outlook Calendar
                </h3>
                <p className="text-sm text-gray-400">Coming soon</p>
              </div>

              {/* Apple Calendar */}
              <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl opacity-50 cursor-not-allowed">
                <div className="text-4xl mb-3">🍎</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Apple Calendar
                </h3>
                <p className="text-sm text-gray-400">Coming soon</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: WITH EVENTS
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#0f0f23] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Meetings</h1>
            <p className="text-gray-400">Upcoming meetings from your connected calendars</p>
          </div>
          <button
            onClick={handleConnectGoogle}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            + Connect Calendar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Events List */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading meetings...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-400">No upcoming meetings</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-6 bg-white/5 backdrop-blur-sm border rounded-xl cursor-pointer transition-all ${
                      selectedEvent?.id === event.id
                        ? "border-purple-500"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {event.summary}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {new Date(event.startTime).toLocaleString()}
                          </div>
                          {event.attendees.length > 0 && (
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      {event.meetingLink && (
                        <a
                          href={event.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 transition-colors"
                        >
                          Join
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Event Details & Connections */}
          <div className="space-y-6">
            {/* Selected Event Details */}
            {selectedEvent && (
              <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Meeting Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">Title</div>
                    <div className="text-white">{selectedEvent.summary}</div>
                  </div>
                  {selectedEvent.description && (
                    <div>
                      <div className="text-gray-400 mb-1">Description</div>
                      <div className="text-white">{selectedEvent.description}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-400 mb-1">When</div>
                    <div className="text-white">
                      {new Date(selectedEvent.startTime).toLocaleString()}
                    </div>
                  </div>
                  {selectedEvent.attendees.length > 0 && (
                    <div>
                      <div className="text-gray-400 mb-1">Attendees</div>
                      <div className="text-white space-y-1">
                        {selectedEvent.attendees.map((email, i) => (
                          <div key={i}>{email}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Connected Calendars */}
            <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Connected Calendars
              </h3>
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {conn.provider === "google" ? "📅" : "📧"}
                      </div>
                      <div>
                        <div className="text-white font-medium capitalize">
                          {conn.provider} Calendar
                        </div>
                        <div className="text-xs text-gray-400">
                          {conn.isExpired ? "Token expired" : "Connected"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(conn.provider)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

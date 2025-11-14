/**
 * Horalix Halo - Settings Page
 *
 * Complete account management:
 * - Profile & subscription
 * - Biometric devices
 * - Knowledge documents
 * - Security settings
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { Card } from '../ui/card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BiometricDevice {
  id: string
  deviceName: string
  createdAt: number
  lastUsedAt: number | null
}

interface KnowledgeDocument {
  id: string
  filename: string
  fileSize: number
  isProcessed: boolean
  createdAt: number
}

interface License {
  id: string
  licenseKey: string
  planId: string
  status: string
  activatedAt: number | null
  expiresAt: number | null
  createdAt: number
}

export function SettingsPage() {
  const { user, token, logout, refreshUser } = useAuth()
  const { subscription, refreshSubscription } = useSubscription()
  const [activeTab, setActiveTab] = useState<'account' | 'subscription' | 'biometric' | 'knowledge' | 'security'>(
    'account'
  )

  // Biometric devices
  const [biometricDevices, setBiometricDevices] = useState<BiometricDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  // Knowledge documents
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // License activation
  const [licenseKey, setLicenseKey] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [licenseError, setLicenseError] = useState('')
  const [licenseSuccess, setLicenseSuccess] = useState('')
  const [myLicenses, setMyLicenses] = useState<License[]>([])
  const [loadingLicenses, setLoadingLicenses] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // Load biometric devices
  useEffect(() => {
    if (activeTab === 'biometric') {
      loadBiometricDevices()
    }
  }, [activeTab])

  // Load knowledge documents
  useEffect(() => {
    if (activeTab === 'knowledge') {
      loadDocuments()
    }
  }, [activeTab])

  // Load licenses
  useEffect(() => {
    if (activeTab === 'subscription') {
      loadMyLicenses()
    }
  }, [activeTab])

  const loadBiometricDevices = async () => {
    setLoadingDevices(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/webauthn/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setBiometricDevices(data.credentials)
      }
    } catch (error) {
      console.error('Failed to load biometric devices:', error)
    } finally {
      setLoadingDevices(false)
    }
  }

  const removeBiometricDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this biometric device?')) return

    try {
      const response = await fetch(`${API_URL}/api/auth/webauthn/credentials/${deviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setBiometricDevices(biometricDevices.filter((d) => d.id !== deviceId))
      }
    } catch (error) {
      console.error('Failed to remove device:', error)
      alert('Failed to remove device')
    }
  }

  const loadDocuments = async () => {
    setLoadingDocs(true)
    try {
      const response = await fetch(`${API_URL}/api/knowledge/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const uploadDocument = async (file: File) => {
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/api/knowledge/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        alert('Document uploaded successfully!')
        loadDocuments()
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
      alert('Upload failed')
    } finally {
      setUploadingDoc(false)
    }
  }

  const deleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const response = await fetch(`${API_URL}/api/knowledge/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setDocuments(documents.filter((d) => d.id !== docId))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert('Failed to delete document')
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setPasswordSuccess('Password changed successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        setPasswordError(data.error || 'Password change failed')
      }
    } catch (error) {
      setPasswordError('Password change failed')
    }
  }

  const loadMyLicenses = async () => {
    setLoadingLicenses(true)
    try {
      const response = await fetch(`${API_URL}/api/licenses/my-licenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setMyLicenses(data.licenses)
      }
    } catch (error) {
      console.error('Failed to load licenses:', error)
    } finally {
      setLoadingLicenses(false)
    }
  }

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    setLicenseError('')
    setLicenseSuccess('')

    if (!licenseKey.trim()) {
      setLicenseError('Please enter a license key')
      return
    }

    setActivatingLicense(true)

    try {
      const response = await fetch(`${API_URL}/api/licenses/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })

      const data = await response.json()
      if (data.success) {
        setLicenseSuccess(data.message || 'License activated successfully!')
        setLicenseKey('')
        // Refresh user data to get updated plan
        await refreshUser()
        await refreshSubscription()
        // Reload licenses
        loadMyLicenses()
      } else {
        setLicenseError(data.error || 'License activation failed')
      }
    } catch (error) {
      setLicenseError('License activation failed')
    } finally {
      setActivatingLicense(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone!')) return

    const password = prompt('Please enter your password to confirm account deletion:')
    if (!password) return

    try {
      const response = await fetch(`${API_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Account deleted successfully')
        logout()
        window.location.href = '/login'
      } else {
        alert(data.error || 'Account deletion failed')
      }
    } catch (error) {
      alert('Account deletion failed')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Please login to access settings</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-400 mt-2">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 overflow-x-auto">
          {['account', 'subscription', 'biometric', 'knowledge', 'security'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-black/30 text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30 p-6">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Account Information</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-3 border-b border-gray-700">
                    <span className="text-gray-400">Email</span>
                    <span className="text-white font-medium">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-700">
                    <span className="text-gray-400">User ID</span>
                    <span className="text-white font-mono text-sm">{user.id}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-700">
                    <span className="text-gray-400">Current Plan</span>
                    <span className="text-white font-semibold uppercase">{user.currentPlan}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-700">
                <button
                  onClick={logout}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Current Subscription</h2>
                {subscription ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-gray-700">
                      <span className="text-gray-400">Plan</span>
                      <span className="text-white font-semibold uppercase">{subscription.planId}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-700">
                      <span className="text-gray-400">Status</span>
                      <span className="text-green-400 font-semibold uppercase">{subscription.status}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-gray-700">
                      <span className="text-gray-400">Billing</span>
                      <span className="text-white">{subscription.billingInterval}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-400 mb-4">No active subscription. Upgrade to access premium features!</p>
                    <a
                      href="/pricing"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
                    >
                      View Plans
                    </a>
                  </div>
                )}
              </div>

              {/* License Activation */}
              <div className="pt-8 border-t border-purple-500/30">
                <h2 className="text-2xl font-bold text-white mb-4">Activate License Key</h2>
                <p className="text-gray-400 mb-4">
                  Have a license key from your purchase? Enter it below to activate your plan instantly.
                </p>

                {licenseError && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {licenseError}
                  </div>
                )}
                {licenseSuccess && (
                  <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                    {licenseSuccess}
                  </div>
                )}

                <form onSubmit={handleActivateLicense} className="space-y-4 max-w-2xl">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="HORALIX-XXXX-XXXX-XXXX-XXXX"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                      disabled={activatingLicense}
                    />
                    <button
                      type="submit"
                      disabled={activatingLicense}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activatingLicense ? 'Activating...' : 'Activate'}
                    </button>
                  </div>
                </form>

                <p className="text-sm text-gray-500 mt-3">
                  License keys are sent to your email after purchase. Check your inbox and spam folder.
                </p>
              </div>

              {/* My Licenses */}
              <div className="pt-8 border-t border-purple-500/30">
                <h2 className="text-2xl font-bold text-white mb-4">My Licenses</h2>
                {loadingLicenses ? (
                  <p className="text-gray-400">Loading...</p>
                ) : myLicenses.length === 0 ? (
                  <p className="text-gray-400">No licenses activated yet.</p>
                ) : (
                  <div className="space-y-3">
                    {myLicenses.map((license) => (
                      <div key={license.id} className="p-4 bg-black/30 rounded-lg border border-purple-500/20">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-white font-semibold uppercase">{license.planId} Plan</p>
                            <p className="text-sm text-gray-500 font-mono">{license.licenseKey}</p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              license.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {license.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          {license.activatedAt && (
                            <p>Activated: {new Date(license.activatedAt).toLocaleDateString()}</p>
                          )}
                          {license.expiresAt && (
                            <p>Expires: {new Date(license.expiresAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Biometric Tab */}
          {activeTab === 'biometric' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Biometric Devices</h2>
                <a
                  href="/biometric-setup"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  Add Device
                </a>
              </div>

              {loadingDevices ? (
                <p className="text-gray-400">Loading...</p>
              ) : biometricDevices.length === 0 ? (
                <p className="text-gray-400">No biometric devices registered. Add one to enable quick login!</p>
              ) : (
                <div className="space-y-3">
                  {biometricDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex justify-between items-center p-4 bg-black/30 rounded-lg"
                    >
                      <div>
                        <p className="text-white font-medium">{device.deviceName}</p>
                        <p className="text-sm text-gray-500">
                          Added: {new Date(device.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeBiometricDevice(device.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Knowledge Documents</h2>
                {user.currentPlan === 'ultra' && (
                  <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition cursor-pointer">
                    Upload Document
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadDocument(e.target.files[0])
                        }
                      }}
                      disabled={uploadingDoc}
                    />
                  </label>
                )}
              </div>

              {user.currentPlan !== 'ultra' ? (
                <div>
                  <p className="text-gray-400 mb-4">
                    Custom knowledge uploads are available on the Ultra plan ($19/mo)
                  </p>
                  <a
                    href="/pricing"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
                  >
                    Upgrade to Ultra
                  </a>
                </div>
              ) : loadingDocs ? (
                <p className="text-gray-400">Loading...</p>
              ) : documents.length === 0 ? (
                <p className="text-gray-400">No documents uploaded yet. Upload PDFs, DOCX, images, or text files!</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex justify-between items-center p-4 bg-black/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{doc.filename}</p>
                        <p className="text-sm text-gray-500">
                          {(doc.fileSize / 1024).toFixed(1)} KB •{' '}
                          {doc.isProcessed ? 'Processed' : 'Processing...'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Change Password</h2>
                {passwordError && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                    {passwordSuccess}
                  </div>
                )}
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white"
                    required
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white"
                    required
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    Change Password
                  </button>
                </form>
              </div>

              <div className="pt-8 border-t border-red-500/30">
                <h2 className="text-2xl font-bold text-red-400 mb-4">Danger Zone</h2>
                <p className="text-gray-400 mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

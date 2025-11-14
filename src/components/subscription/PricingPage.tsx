/**
 * Horalix Halo - Pricing Page
 *
 * Beautiful pricing cards for all subscription tiers.
 * Handles upgrade flow and checkout creation.
 */

import React, { useState } from "react"
import { motion } from "framer-motion"
import { useSubscription, usePlan } from "../../contexts/SubscriptionContext"
import { PLANS } from "../../../shared/plans"
import type { PlanId } from "../../../shared/plans"

// ============================================================================
// TYPES
// ============================================================================

interface PricingCardProps {
  planId: PlanId
  isCurrentPlan: boolean
  billingInterval: "month" | "year"
  onSelectPlan: (planId: PlanId, interval: "month" | "year") => Promise<void>
  isLoading?: boolean
}

// ============================================================================
// PRICING CARD
// ============================================================================

const PricingCard: React.FC<PricingCardProps> = ({
  planId,
  isCurrentPlan,
  billingInterval,
  onSelectPlan,
  isLoading,
}) => {
  const plan = PLANS[planId]
  const pricing = plan.pricing[billingInterval]

  const getCardGradient = () => {
    if (planId === "ultra") return "from-yellow-500/20 to-orange-500/20"
    if (planId === "plus") return "from-purple-500/20 to-pink-500/20"
    return "from-gray-500/20 to-gray-600/20"
  }

  const getBorderGradient = () => {
    if (planId === "ultra") return "from-yellow-500/50 to-orange-500/50"
    if (planId === "plus") return "from-purple-500/50 to-pink-500/50"
    return "from-gray-500/50 to-gray-600/50"
  }

  const getButtonGradient = () => {
    if (planId === "ultra") return "from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
    if (planId === "plus") return "from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
    return "from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
  }

  const isRecommended = planId === "plus"
  const isFree = planId === "free"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative ${isRecommended ? "scale-105 z-10" : ""}`}
    >
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full shadow-lg">
            RECOMMENDED
          </div>
        </div>
      )}

      <div
        className={`relative p-8 rounded-2xl bg-gradient-to-br ${getCardGradient()} backdrop-blur-sm border-2 border-transparent`}
        style={{
          backgroundImage: `linear-gradient(#0f0f23, #0f0f23), linear-gradient(135deg, ${planId === "ultra" ? "rgb(234, 179, 8), rgb(249, 115, 22)" : planId === "plus" ? "rgb(168, 85, 247), rgb(236, 72, 153)" : "rgb(107, 114, 128), rgb(75, 85, 99)"})`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        {/* Plan Name */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">
            {plan.marketing.name}
          </h3>
          <p className="text-sm text-gray-400">
            {plan.marketing.tagline}
          </p>
        </div>

        {/* Pricing */}
        <div className="text-center mb-8">
          {isFree ? (
            <div>
              <div className="text-5xl font-bold text-white mb-2">Free</div>
              <div className="text-sm text-gray-400">Trial only</div>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-2xl text-gray-400">$</span>
                <span className="text-5xl font-bold text-white">
                  {pricing.price}
                </span>
                <span className="text-gray-400">/{billingInterval === "month" ? "mo" : "yr"}</span>
              </div>
              {billingInterval === "year" && (
                <div className="text-sm text-green-400 font-medium">
                  Save ${(pricing.price / 12).toFixed(0)}/month
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {pricing.description}
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          {plan.marketing.bullets.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${planId === "ultra" ? "text-yellow-400" : planId === "plus" ? "text-purple-400" : "text-gray-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-300">{feature}</span>
            </div>
          ))}
        </div>

        {/* Target Users */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Perfect for:
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.marketing.targetUsers.map((user, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-gray-400"
              >
                {user}
              </span>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        {isCurrentPlan ? (
          <div className="w-full py-3 bg-white/10 text-white font-semibold rounded-lg text-center border border-white/20">
            Current Plan
          </div>
        ) : (
          <button
            onClick={() => onSelectPlan(planId, billingInterval)}
            disabled={isLoading || isFree}
            className={`w-full py-3 bg-gradient-to-r ${getButtonGradient()} text-white font-semibold rounded-lg transition-all shadow-lg ${
              planId === "ultra" ? "shadow-yellow-500/20" : planId === "plus" ? "shadow-purple-500/20" : "shadow-gray-500/20"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? "Processing..." : isFree ? "Current Plan" : "Upgrade Now"}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================================
// PRICING PAGE
// ============================================================================

export const PricingPage: React.FC = () => {
  const { planId } = usePlan()
  const { startCheckout } = useSubscription()
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month")
  const [isLoading, setIsLoading] = useState(false)

  const handleSelectPlan = async (targetPlan: PlanId, interval: "month" | "year") => {
    if (targetPlan === "free") return

    setIsLoading(true)
    try {
      await startCheckout(targetPlan, interval)
    } catch (error) {
      console.error("[PricingPage] Checkout error:", error)
      // TODO: Show error toast
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#0f0f23] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-white mb-4"
          >
            Choose Your <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Halo</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Upgrade your meeting superpowers. Cancel anytime.
          </motion.p>
        </div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <button
            onClick={() => setBillingInterval("month")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              billingInterval === "month"
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval("year")}
            className={`px-6 py-2 rounded-lg font-medium transition-all relative ${
              billingInterval === "year"
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Yearly
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
              SAVE 17%
            </span>
          </button>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <PricingCard
            planId="free"
            isCurrentPlan={planId === "free"}
            billingInterval={billingInterval}
            onSelectPlan={handleSelectPlan}
            isLoading={isLoading}
          />
          <PricingCard
            planId="plus"
            isCurrentPlan={planId === "plus"}
            billingInterval={billingInterval}
            onSelectPlan={handleSelectPlan}
            isLoading={isLoading}
          />
          <PricingCard
            planId="ultra"
            isCurrentPlan={planId === "ultra"}
            billingInterval={billingInterval}
            onSelectPlan={handleSelectPlan}
            isLoading={isLoading}
          />
        </div>

        {/* FAQ or Trust Signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure payments
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Instant activation
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

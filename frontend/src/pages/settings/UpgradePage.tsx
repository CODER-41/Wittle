import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { Check, Zap, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  billing?: string
  features: string[]
}

export default function UpgradePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/subscriptions/plans')
      .then(res => setPlans(res.data.plans))
      .catch(console.error)
  }, [])

  const handleUpgrade = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/subscriptions/subscribe', {
        email: user?.email
      })
      window.location.href = res.data.authorization_url
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const currentPlan = user?.plan || 'free'

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Upgrade Wittle</h1>
          <p className="text-gray-500 text-sm mt-1">
            You are on the <span className="font-medium capitalize">{currentPlan}</span> plan
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {plans.map(plan => {
          const isCurrent = plan.id === currentPlan
          const isPro = plan.id === 'pro'

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-6 relative ${
                isPro ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap size={11} />
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    KES {plan.price.toLocaleString()}
                  </span>
                  {plan.billing && (
                    <span className="text-gray-500 text-sm ml-1">/ month</span>
                  )}
                  {plan.price === 0 && (
                    <span className="text-gray-500 text-sm ml-1">forever</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className={isPro ? 'text-blue-500' : 'text-green-500'} />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2.5 text-center text-sm font-medium text-gray-500 border border-gray-200 rounded-lg">
                  Current plan
                </div>
              ) : isPro ? (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {loading ? 'Redirecting to payment...' : 'Upgrade to Pro — KES 999/mo'}
                </button>
              ) : (
                <div className="w-full py-2.5 text-center text-sm font-medium text-gray-500 border border-gray-200 rounded-lg">
                  Downgrade
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Secure payments via Paystack · Cancel anytime
      </p>
    </div>
  )
}
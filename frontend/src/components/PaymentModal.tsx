import { useState, useEffect, useRef } from 'react'
import { Invoice } from '../types'
import api from '../api/client'
import { X, Smartphone, CreditCard, ExternalLink, ArrowLeft, CheckCircle, Loader } from 'lucide-react'

interface Props {
  invoice: Invoice
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ invoice, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<'mpesa' | 'card' | null>(null)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cardUrl, setCardUrl] = useState('')
  const [reference, setReference] = useState('')
  const [pollStatus, setPollStatus] = useState<'polling' | 'success' | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = (ref: string) => {
    setPollStatus('polling')
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/payments/mpesa/verify/${ref}`)
        if (res.data.paystack_status === 'success') {
          clearInterval(pollRef.current!)
          setPollStatus('success')
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 2000)
        } else if (res.data.paystack_status === 'failed') {
          clearInterval(pollRef.current!)
          setError('Payment failed. Please try again.')
          setPollStatus(null)
        }
      } catch {
        // keep polling
      }
    }, 3000)

    // stop polling after 3 minutes
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (pollStatus !== 'success') {
        setError('Payment timed out. Please verify manually.')
        setPollStatus(null)
      }
    }, 180000)
  }

  const handleMpesa = async () => {
    if (!phone) { setError('Please enter a phone number'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/payments/mpesa/initiate', {
        invoice_id: invoice.id,
        phone: phone.startsWith('+') ? phone : `+254${phone.replace(/^0/, '')}`,
      })
      const ref = res.data.payment.reference
      setReference(ref)
      startPolling(ref)
    } catch (err) {
      const e = err as any
      setError(e.response?.data?.error || 'Failed to initiate M-Pesa payment')
    } finally {
      setLoading(false)
    }
  }

  const handleCard = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/payments/card/initiate', { invoice_id: invoice.id })
      setCardUrl(res.data.authorization_url)
    } catch (err) {
      const e = err as any
      setError(e.response?.data?.error || 'Failed to initialize card payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Collect Payment</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {invoice.invoice_number} · KES {invoice.total.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Success screen */}
          {pollStatus === 'success' && (
            <div className="text-center py-6">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">Payment Confirmed!</p>
              <p className="text-sm text-gray-500 mt-1">KES {invoice.total.toLocaleString()} received</p>
            </div>
          )}

          {/* Polling screen */}
          {pollStatus === 'polling' && (
            <div className="text-center py-6">
              <Loader size={36} className="text-green-500 mx-auto mb-3 animate-spin" />
              <p className="font-semibold text-gray-900">Waiting for payment...</p>
              <p className="text-sm text-gray-500 mt-1">Ask the client to enter their M-Pesa PIN</p>
              <p className="text-xs text-gray-400 mt-2">Ref: {reference}</p>
            </div>
          )}

          {/* Card URL */}
          {cardUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Payment link ready</p>
              <p className="text-xs text-blue-700 break-all mb-3">{cardUrl}</p>
              <a href={cardUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <ExternalLink size={14} />
                Open checkout page
              </a>
            </div>
          )}

          {/* Method selection */}
          {!method && !cardUrl && !pollStatus && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">Choose payment method:</p>
              <button onClick={() => setMethod('mpesa')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl transition-colors text-left">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Smartphone size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">M-Pesa STK Push</p>
                  <p className="text-xs text-gray-500">Send payment request to client phone</p>
                </div>
              </button>
              <button onClick={() => { setMethod('card'); handleCard() }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-colors text-left">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Card Payment</p>
                  <p className="text-xs text-gray-500">Generate a Paystack checkout link</p>
                </div>
              </button>
            </div>
          )}

          {/* M-Pesa phone input */}
          {method === 'mpesa' && !cardUrl && !pollStatus && (
            <div className="space-y-4">
              <button onClick={() => { setMethod(null); setError('') }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft size={14} />
                Back
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client M-Pesa phone number
                </label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus />
                <p className="text-xs text-gray-400 mt-1">Client will receive an STK push on their phone</p>
              </div>
              <button onClick={handleMpesa} disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {loading ? 'Sending request...' : 'Send M-Pesa Request'}
              </button>
            </div>
          )}

          {method === 'card' && loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Generating payment link...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

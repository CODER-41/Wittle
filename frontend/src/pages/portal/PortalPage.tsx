import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Smartphone, CreditCard, CheckCircle, FileText, ExternalLink, ArrowLeft } from 'lucide-react'

const publicApi = axios.create({ baseURL: 'http://localhost:8080/api' })

interface InvoiceItem {
  id: number
  description: string
  quantity: number
  amount: number
}

interface PortalInvoice {
  id: number
  invoice_number: string
  status: string
  subtotal: number
  tax: number
  total: number
  due_date: string | null
  notes: string
  items: InvoiceItem[]
}

interface PortalData {
  invoice: PortalInvoice
  client: { name: string }
  business: { name: string }
}

type PayMethod = 'mpesa' | 'card' | null

export default function PortalPage() {
  const { token } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [method, setMethod] = useState<PayMethod>(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [mpesaSent, setMpesaSent] = useState(false)
  const [cardUrl, setCardUrl] = useState('')

  useEffect(() => {
    publicApi.get(`/invoices/portal/${token}`)
      .then(res => setData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const handleMpesa = async () => {
    if (!phone) { setError('Phone number is required'); return }
    setError('')
    setPaying(true)
    try {
      await publicApi.post(`/invoices/portal/${token}/pay/mpesa`, {
        phone: phone.startsWith('+') ? phone : `+254${phone.replace(/^0/, '')}`,
      })
      setMpesaSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const handleCard = async () => {
    if (!email) { setError('Email is required'); return }
    setError('')
    setPaying(true)
    try {
      const res = await publicApi.post(`/invoices/portal/${token}/pay/card`, { email })
      setCardUrl(res.data.authorization_url)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <FileText size={32} className="mx-auto mb-3 text-gray-300" />
          <h2 className="font-semibold text-gray-900 mb-2">Invoice not found</h2>
          <p className="text-sm text-gray-500">This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const { invoice, client, business } = data!
  const isPaid = invoice.status === 'paid'

  const renderPaymentSection = () => {
    if (isPaid) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <CheckCircle size={32} className="mx-auto mb-2 text-green-600" />
          <p className="font-semibold text-green-800">This invoice has been paid</p>
          <p className="text-sm text-green-600 mt-1">Thank you for your payment.</p>
        </div>
      )
    }

    if (mpesaSent) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <Smartphone size={32} className="mx-auto mb-2 text-green-600" />
          <p className="font-semibold text-green-800">M-Pesa request sent</p>
          <p className="text-sm text-green-600 mt-1">
            Check your phone and enter your PIN to complete payment.
          </p>
        </div>
      )
    }

    if (cardUrl) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="font-semibold text-blue-900 mb-3">Your payment link is ready</p>
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
          >
            <ExternalLink size={16} />
            Complete Payment
          </a>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Pay this invoice</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {method === null && (
          <div className="space-y-3">
            <button
              onClick={() => setMethod('mpesa')}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl transition-colors text-left"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Smartphone size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Pay with M-Pesa</p>
                <p className="text-xs text-gray-500">Receive STK push on your phone</p>
              </div>
            </button>

            <button
              onClick={() => setMethod('card')}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-colors text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Pay with Card</p>
                <p className="text-xs text-gray-500">Visa, Mastercard via Paystack</p>
              </div>
            </button>
          </div>
        )}

        {method === 'mpesa' && (
          <div className="space-y-4">
            <button
              onClick={() => { setMethod(null); setError('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your M-Pesa phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleMpesa}
              disabled={paying}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 rounded-lg text-sm transition-colors"
            >
              {paying ? 'Sending request...' : `Pay KES ${invoice.total.toLocaleString()}`}
            </button>
          </div>
        )}

        {method === 'card' && (
          <div className="space-y-4">
            <button
              onClick={() => { setMethod(null); setError('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Used for your payment receipt</p>
            </div>
            <button
              onClick={handleCard}
              disabled={paying}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg text-sm transition-colors"
            >
              {paying ? 'Generating link...' : `Pay KES ${invoice.total.toLocaleString()}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Invoice from Wittle</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Invoice</p>
              <p className="font-bold text-gray-900 text-lg">{invoice.invoice_number}</p>
              <p className="text-sm text-gray-500 mt-0.5">To: {client.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Amount Due</p>
              <p className="text-2xl font-bold text-gray-900">
                KES {invoice.total.toLocaleString()}
              </p>
              {invoice.due_date && (
                <p className="text-xs text-gray-400 mt-1">
                  Due {new Date(invoice.due_date).toLocaleDateString('en-KE')}
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left pb-3 font-medium">Description</th>
                  <th className="text-center pb-3 font-medium w-16">Qty</th>
                  <th className="text-right pb-3 font-medium w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-gray-900">{item.description}</td>
                    <td className="py-3 text-center text-gray-500">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-900">
                      KES {item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>KES {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>VAT (16%)</span>
                <span>KES {invoice.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>KES {invoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="px-6 pb-6 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Note: </span>{invoice.notes}
            </div>
          )}
        </div>

        {renderPaymentSection()}

        <p className="text-center text-xs text-gray-400 py-6">
          Powered by Wittle · Secure payments via Paystack
        </p>
      </div>
    </div>
  )
}
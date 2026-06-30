import { useEffect, useState } from 'react'
import api from '../../api/client'
import { Payment } from '../../types'
import { CreditCard, Smartphone, CheckCircle, Clock, XCircle } from 'lucide-react'

const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle size={15} className="text-green-500" />,
  pending: <Clock size={15} className="text-amber-500" />,
  failed: <XCircle size={15} className="text-red-500" />,
}

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}


export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/payments/')
      .then(res => setPayments(res.data.payments))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalRevenue = payments
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500 text-sm mt-1">
          KES {totalRevenue.toLocaleString()} total collected
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Successful</p>
          <p className="text-2xl font-bold text-green-600">
            {payments.filter(p => p.status === 'success').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {payments.filter(p => p.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Payments list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No payments yet</p>
          </div>
        ) : (
          payments.map(payment => (
            <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  {payment.method === 'mpesa'
                    ? <Smartphone size={16} className="text-green-600" />
                    : <CreditCard size={16} className="text-blue-600" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {payment.method === 'mpesa' ? 'M-Pesa' : 'Card'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {payment.reference}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  {statusIcons[payment.status]}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[payment.status]}`}>
                    {payment.status}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 w-28 text-right">
                  KES {payment.amount.toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
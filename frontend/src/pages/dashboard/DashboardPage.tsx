import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { FileText, Users, CreditCard, TrendingUp } from 'lucide-react'

interface Stats {
  total_invoices: number
  paid_invoices: number
  total_clients: number
  total_revenue: number
  pending_invoices: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/invoices/?per_page=5'),
      api.get('/clients/'),
    ]).then(([invoicesRes, clientsRes]) => {
      const invoices = invoicesRes.data.invoices
      const totalRevenue = invoices
        .filter((i: any) => i.status === 'paid')
        .reduce((sum: number, i: any) => sum + i.total, 0)

      setStats({
        total_invoices: invoicesRes.data.total,
        paid_invoices: invoices.filter((i: any) => i.status === 'paid').length,
        pending_invoices: invoices.filter((i: any) => i.status === 'draft' || i.status === 'sent').length,
        total_clients: clientsRes.data.total,
        total_revenue: totalRevenue,
      })
      setRecentInvoices(invoices.slice(0, 5))
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening with {user?.business_name || 'your business'}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total Revenue</span>
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            KES {stats?.total_revenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">from paid invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Invoices</span>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_invoices}</p>
          <p className="text-xs text-gray-400 mt-1">{stats?.paid_invoices} paid</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Clients</span>
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_clients}</p>
          <p className="text-xs text-gray-400 mt-1">active clients</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Pending</span>
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <CreditCard size={16} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.pending_invoices}</p>
          <p className="text-xs text-gray-400 mt-1">awaiting payment</p>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
          <button
            onClick={() => navigate('/invoices')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No invoices yet</p>
              <button
                onClick={() => navigate('/invoices')}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700"
              >
                Create your first invoice
              </button>
            </div>
          ) : (
            recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-KE') : 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[invoice.status]}`}>
                    {invoice.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    KES {invoice.total.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
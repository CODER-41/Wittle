import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { Invoice } from '../../types'
import { Plus, FileText, Download, Send, CreditCard } from 'lucide-react'
import PaymentModal from '../../components/PaymentModal'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [sending, setSending] = useState<number | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)

  const fetchInvoices = (status = '') => {
    const query = status ? `?status=${status}` : ''
    api.get(`/invoices/${query}`)
      .then(res => setInvoices(res.data.invoices))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchInvoices(statusFilter) }, [statusFilter])

  const handleDownloadPDF = async (invoice: Invoice) => {
    const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleSend = async (invoice: Invoice) => {
    setSending(invoice.id)
    try {
      await api.post(`/invoices/${invoice.id}/send`)
      fetchInvoices(statusFilter)
    } catch (err) {
      console.error(err)
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{invoices.length} total</p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Invoice
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {['', 'draft', 'sent', 'paid', 'overdue'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {status === '' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Invoices list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No invoices found</p>
            <button
              onClick={() => navigate('/invoices/new')}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              Create your first invoice
            </button>
          </div>
        ) : (
          invoices.map(invoice => (
            <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Due {invoice.due_date
                      ? new Date(invoice.due_date).toLocaleDateString('en-KE')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[invoice.status]}`}>
                  {invoice.status}
                </span>
                <span className="text-sm font-semibold text-gray-900 w-28 text-right">
                  KES {invoice.total.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadPDF(invoice)}
                    title="Download PDF"
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Download size={15} />
                  </button>
                  {invoice.status !== 'paid' && (
                    <>
                      <button
                        onClick={() => handleSend(invoice)}
                        disabled={sending === invoice.id}
                        title="Send invoice"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Send size={15} />
                      </button>
                      <button
                        onClick={() => setPaymentInvoice(invoice)}
                        title="Collect payment"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <CreditCard size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment modal */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => {
            fetchInvoices(statusFilter)
            setPaymentInvoice(null)
          }}
        />
      )}
    </div>
  )
}
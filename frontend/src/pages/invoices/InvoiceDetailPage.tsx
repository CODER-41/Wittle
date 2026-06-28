import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { Invoice } from '../../types'
import { ArrowLeft, Download, Send, CreditCard, FileText } from 'lucide-react'
import PaymentModal from '../../components/PaymentModal'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    api.get(`/invoices/${id}`)
      .then(res => {
        setInvoice(res.data.invoice)
        return api.get(`/clients/${res.data.invoice.client_id}`)
      })
      .then(res => setClientName(res.data.client.name))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleDownloadPDF = async () => {
    if (!invoice) return
    const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleSend = async () => {
    if (!invoice) return
    setSending(true)
    try {
      await api.post(`/invoices/${invoice.id}/send`)
      const res = await api.get(`/invoices/${id}`)
      setInvoice(res.data.invoice)
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  if (!invoice) return (
    <div className="p-8 text-center text-gray-400">
      <FileText size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">Invoice not found</p>
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={15} />
            PDF
          </button>
          {invoice.status !== 'paid' && (
            <>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40"
              >
                <Send size={15} />
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => setShowPayment(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CreditCard size={15} />
                Collect Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Invoice card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Client + dates */}
        <div className="p-6 border-b border-gray-100 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-semibold text-gray-900">{clientName}</p>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice Date</p>
              <p className="text-sm text-gray-700">
                {new Date(invoice.created_at).toLocaleDateString('en-KE')}
              </p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Due Date</p>
                <p className="text-sm text-gray-700">
                  {new Date(invoice.due_date).toLocaleDateString('en-KE')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left pb-3 font-medium">Description</th>
                <th className="text-center pb-3 font-medium w-16">Qty</th>
                <th className="text-right pb-3 font-medium w-32">Unit Price</th>
                <th className="text-right pb-3 font-medium w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map(item => (
                <tr key={item.id}>
                  <td className="py-3 text-gray-900">{item.description}</td>
                  <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-600">
                    KES {item.unit_price.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    KES {item.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>KES {invoice.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT (16%)</span>
              <span>KES {invoice.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>KES {invoice.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="px-6 pb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            api.get(`/invoices/${id}`).then(res => setInvoice(res.data.invoice))
          }}
        />
      )}
    </div>
  )
}
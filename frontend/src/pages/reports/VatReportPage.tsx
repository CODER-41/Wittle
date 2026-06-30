import { useState } from 'react'
import api from '../../api/client'
import { FileText, Download, Calendar } from 'lucide-react'

interface VatReportInvoice {
  invoice_number: string
  date: string
  subtotal: number
  vat: number
  total: number
}

interface VatReport {
  month: number
  year: number
  business_name: string
  kra_pin: string | null
  invoice_count: number
  total_subtotal: number
  total_vat_collected: number
  total_gross: number
  invoices: VatReportInvoice[]
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function VatReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState<VatReport | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/invoices/vat-report?month=${month}&year=${year}`)
      setReport(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!report) return
    const rows = [
      ['Invoice Number', 'Date', 'Subtotal', 'VAT', 'Total'],
      ...report.invoices.map(inv => [
        inv.invoice_number, inv.date, inv.subtotal, inv.vat, inv.total
      ]),
      [],
      ['Total Subtotal', '', report.total_subtotal],
      ['Total VAT Collected', '', report.total_vat_collected],
      ['Total Gross', '', report.total_gross],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VAT-Report-${months[month - 1]}-${year}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">VAT Report</h1>
        <p className="text-gray-500 text-sm mt-1">Monthly VAT summary for your accountant</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Calendar size={15} />
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Invoices</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{report.invoice_count}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Subtotal</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                KES {report.total_subtotal.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-blue-600 mb-1">VAT Collected</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-700">
                KES {report.total_vat_collected.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Download */}
          <div className="flex justify-end mb-4">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={15} />
              Download CSV
            </button>
          </div>

          {/* Invoice list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="text-left p-3 font-medium">Invoice</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-right p-3 font-medium">Subtotal</th>
                    <th className="text-right p-3 font-medium">VAT</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        <FileText size={28} className="mx-auto mb-2 opacity-30" />
                        No paid invoices for this period
                      </td>
                    </tr>
                  ) : (
                    report.invoices.map(inv => (
                      <tr key={inv.invoice_number}>
                        <td className="p-3 font-medium text-gray-900">{inv.invoice_number}</td>
                        <td className="p-3 text-gray-500">
                          {new Date(inv.date).toLocaleDateString('en-KE')}
                        </td>
                        <td className="p-3 text-right text-gray-600">
                          KES {inv.subtotal.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-gray-600">
                          KES {inv.vat.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-medium text-gray-900">
                          KES {inv.total.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

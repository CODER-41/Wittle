import { useEffect, useState } from 'react'
import api from '../../api/client'
import { Client } from '../../types'
import { Plus, Trash2, RefreshCw, Pause, Play } from 'lucide-react'

interface RecurringInvoice {
  id: number
  client_id: number
  client_name: string
  frequency: string
  items: { description: string; quantity: number; unit_price: number }[]
  notes: string
  is_active: boolean
  next_run_date: string
  last_run_date: string | null
  invoices_generated: number
}

export default function RecurringPage() {
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_id: '',
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    description: '',
    unit_price: '',
    notes: '',
  })

  const fetchRecurring = () => {
    api.get('/recurring/')
      .then(res => setRecurring(res.data.recurring_invoices))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRecurring()
    api.get('/clients/?per_page=100')
      .then(res => setClients(res.data.clients))
      .catch(console.error)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.client_id || !form.description || !form.unit_price) {
      setError('Client, description and price are required')
      return
    }
    setSaving(true)
    try {
      await api.post('/recurring/', {
        client_id: parseInt(form.client_id),
        frequency: form.frequency,
        start_date: form.start_date,
        items: [{ description: form.description, quantity: 1, unit_price: parseFloat(form.unit_price) }],
        notes: form.notes,
      })
      setForm({ client_id: '', frequency: 'monthly', start_date: new Date().toISOString().split('T')[0], description: '', unit_price: '', notes: '' })
      setShowForm(false)
      fetchRecurring()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any 
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create recurring invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (r: RecurringInvoice) => {
    try {
      await api.patch(`/recurring/${r.id}`, { is_active: !r.is_active })
      fetchRecurring()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring invoice?')) return
    try {
      await api.delete(`/recurring/${id}`)
      fetchRecurring()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Recurring Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">Auto-generate invoices on a schedule</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Recurring</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Recurring Invoice</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select
                  value={form.client_id}
                  onChange={e => setForm({ ...form, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={e => setForm({ ...form, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Monthly retainer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  value={form.unit_price}
                  onChange={e => setForm({ ...form, unit_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-generated monthly retainer"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : recurring.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No recurring invoices yet</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
              Create your first recurring invoice
            </button>
          </div>
        ) : (
          recurring.map(r => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                  <RefreshCw size={16} className={r.is_active ? 'text-blue-600' : 'text-gray-400'} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.client_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.items[0]?.description} · KES {r.items[0]?.unit_price.toLocaleString()} · {r.frequency}
                  </p>
                  <p className="text-xs text-gray-400">
                    Next: {new Date(r.next_run_date).toLocaleDateString('en-KE')} · {r.invoices_generated} generated
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.is_active ? 'Active' : 'Paused'}
                </span>
                <button
                  onClick={() => handleToggle(r)}
                  title={r.is_active ? 'Pause' : 'Resume'}
                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  {r.is_active ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  title="Delete"
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
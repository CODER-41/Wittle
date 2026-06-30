import { useEffect, useState } from 'react'
import api from '../../api/client'
import { Plus, Trash2, TrendingDown, Receipt } from 'lucide-react'

interface Expense {
  id: number
  description: string
  category: string
  amount: number
  expense_date: string
  notes: string
}

const categories = ['rent', 'utilities', 'supplies', 'salaries', 'marketing', 'transport', 'other']

const categoryColors: Record<string, string> = {
  rent: 'bg-purple-100 text-purple-700',
  utilities: 'bg-blue-100 text-blue-700',
  supplies: 'bg-amber-100 text-amber-700',
  salaries: 'bg-green-100 text-green-700',
  marketing: 'bg-pink-100 text-pink-700',
  transport: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-600',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    description: '', category: 'other', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: ''
  })

  const fetchExpenses = () => {
    api.get('/expenses/?per_page=50')
      .then(res => {
        setExpenses(res.data.expenses)
        setTotalAmount(res.data.total_amount)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchExpenses() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.description || !form.amount) {
      setError('Description and amount are required')
      return
    }
    setSaving(true)
    try {
      await api.post('/expenses/', {
        ...form,
        amount: parseFloat(form.amount),
      })
      setForm({ description: '', category: 'other', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' })
      setShowForm(false)
      fetchExpenses()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      fetchExpenses()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-1">Track your business spending</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Expense</span>
        </button>
      </div>

      {/* Summary */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <TrendingDown size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm text-red-600">Total Expenses</p>
            <p className="text-xs text-red-400">{expenses.length} entries</p>
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-red-700">
          KES {totalAmount.toLocaleString()}
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Expense</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Office rent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={e => setForm({ ...form, expense_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
              >
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Receipt size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No expenses recorded yet</p>
          </div>
        ) : (
          expenses.map(expense => (
            <div key={expense.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <Receipt size={16} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(expense.expense_date).toLocaleDateString('en-KE')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${categoryColors[expense.category]}`}>
                  {expense.category}
                </span>
                <span className="text-sm font-semibold text-gray-900 w-24 text-right">
                  KES {expense.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(expense.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
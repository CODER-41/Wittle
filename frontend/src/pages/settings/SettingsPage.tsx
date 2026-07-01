import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { Check, FileText, Zap } from 'lucide-react'

const templates = [
  { id: 'classic', name: 'Classic', description: 'Blue accent, professional and clean' },
  { id: 'modern', name: 'Modern', description: 'Dark header, bold and contemporary' },
  { id: 'minimal', name: 'Minimal', description: 'Serif font, elegant whitespace' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(user?.invoice_template || 'classic')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSelect = async (templateId: string) => {
    setSelected(templateId)
    setSaving(true)
    setSaved(false)
    try {
      await api.patch('/auth/me/template', { invoice_template: templateId })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Customize how your invoices look</p>
      </div>

      {/* Plan section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Your Plan</h2>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              {user?.plan === 'pro' ? 'Pro — Unlimited everything' : 'Free — 5 invoices/month'}
            </p>
          </div>
          {user?.plan !== 'pro' && (
            <button
              onClick={() => navigate('/upgrade')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Zap size={14} />
              Upgrade to Pro
            </button>
          )}
          {user?.plan === 'pro' && (
            <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
              <Zap size={12} />
              Pro
            </span>
          )}
        </div>
      </div>

      {/* Template section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Invoice Template</h2>
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              disabled={saving}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                selected === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <FileText size={18} className={selected === template.id ? 'text-blue-600' : 'text-gray-400'} />
                {selected === template.id && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </div>
              <p className="font-medium text-sm text-gray-900">{template.name}</p>
              <p className="text-xs text-gray-500 mt-1">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
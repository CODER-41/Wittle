import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { UserPlus, Trash2, Mail, Shield, User as UserIcon, Clock } from 'lucide-react'

interface TeamMember {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
}

interface PendingInvite {
  id: number
  email: string
  status: string
  expires_at: string
}

export default function TeamPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isOwner = user?.role === 'owner'

  const fetchTeam = () => {
    api.get('/team/')
      .then(res => {
        setMembers(res.data.members)
        setInvites(res.data.pending_invites)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTeam() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSending(true)
    try {
      await api.post('/team/invite', { email })
      setSuccess(`Invite sent to ${email}`)
      setEmail('')
      setShowInvite(false)
      fetchTeam()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  const handleRemove = async (staffId: number, name: string) => {
    if (!confirm(`Remove ${name} from your team?`)) return
    try {
      await api.delete(`/team/${staffId}`)
      fetchTeam()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove staff member')
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Invite Staff</span>
            <span className="sm:hidden">Invite</span>
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">
          {success}
        </div>
      )}

      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3 mb-6 text-sm">
          Only the business owner can manage team members.
        </div>
      )}

      {/* Invite form */}
      {showInvite && isOwner && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Invite a staff member</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="staff@email.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
              >
                {sending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-6">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 text-sm font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Mail size={11} /> {member.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                  member.role === 'owner'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {member.role === 'owner' ? <Shield size={11} /> : <UserIcon size={11} />}
                  {member.role}
                </span>
                {isOwner && member.role === 'staff' && (
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    title="Remove from team"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Pending Invites</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock size={15} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Expires {new Date(invite.expires_at).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import Layout from './components/Layout'
import DashboardPage from './pages/dashboard/DashboardPage'
import ClientsPage from './pages/clients/ClientsPage'
import InvoicesPage from './pages/invoices/InvoicesPage.tsx'
import NewInvoicePage from './pages/invoices/NewInvoicePage.tsx'
import PaymentsPage from './pages/payments/PaymentsPage'


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/clients" element={
        <ProtectedRoute>
          <ClientsPage />
        </ProtectedRoute>
      } />

      <Route path="/invoices" element={
        <ProtectedRoute>
          <InvoicesPage />
        </ProtectedRoute>
      } />
      <Route path="/invoices/new" element={
        <ProtectedRoute>
          <NewInvoicePage />
        </ProtectedRoute>
      } />
            
      <Route path="/payments" element={
        <ProtectedRoute>
          <PaymentsPage />
        </ProtectedRoute>
      } />

      
      <Route path="/team" element={
        <ProtectedRoute>
          <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-gray-500 mt-1">Coming soon</p>
          </div>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
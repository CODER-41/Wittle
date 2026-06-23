export interface User {
  id: number
  name: string
  email: string
  business_name: string | null
  role: "owner" | "staff"
  owner_id: number | null
  is_active: boolean
  created_at: string
}

export interface Client {
  id: number
  name: string
  email: string
  phone: string
  address: string
  notes: string
  user_id: number
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface Invoice {
  id: number
  user_id: number
  client_id: number
  invoice_number: string
  status: "draft" | "sent" | "paid" | "overdue"
  subtotal: number
  tax: number
  total: number
  due_date: string | null
  notes: string
  items: InvoiceItem[]
  created_at: string
  updated_at: string
}

export interface Payment {
  id: number
  user_id: number
  invoice_id: number
  reference: string
  method: "mpesa" | "card"
  amount: number
  status: "pending" | "success" | "failed"
  phone: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
  message: string
}
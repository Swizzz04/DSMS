/**
 * ticketBridge.js
 * ─────────────────────────────────────────────────────────────────
 * localStorage bridge for support ticket system.
 * Swap with fetch() when .NET backend is ready — zero page changes.
 *
 * Key: cshc_tickets
 *
 * Ticket shape:
 * {
 *   id:          number (Date.now()),
 *   ticketNumber: string (TKT-YYYY-XXXX),
 *   type:        'account' | 'bug' | 'access' | 'inquiry',
 *   priority:    'low' | 'medium' | 'high' | 'urgent',
 *   status:      'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed',
 *   subject:     string,
 *   description: string,
 *   submittedBy: { name, email, role, campus },
 *   submittedDate: ISO string,
 *   updatedDate:   ISO string,
 *   notes:       [{ id, text, author, date }],
 * }
 */

const STORAGE_KEY = 'cshc_tickets'
const COUNTER_KEY = 'cshc_ticket_counter'

function getTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  // Notify same-tab listeners
  window.dispatchEvent(new CustomEvent('cshc_ticket_updated'))
}

function generateTicketNumber() {
  const year = new Date().getFullYear()
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1
  localStorage.setItem(COUNTER_KEY, String(counter))
  return `TKT-${year}-${String(counter).padStart(4, '0')}`
}

export function getAllTickets() {
  return getTickets()
}

export function getTicketsByUser(email) {
  return getTickets().filter(t => t.submittedBy.email === email)
}

export function getTicketStats() {
  const tickets = getTickets()
  return {
    total:       tickets.length,
    open:        tickets.filter(t => t.status === 'open').length,
    inProgress:  tickets.filter(t => t.status === 'in_progress').length,
    onHold:      tickets.filter(t => t.status === 'on_hold').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
    closed:      tickets.filter(t => t.status === 'closed').length,
    urgent:      tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
    high:        tickets.filter(t => t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed').length,
  }
}

export function submitTicket({ type, priority, subject, description, submittedBy }) {
  const tickets = getTickets()
  const newTicket = {
    id: Date.now(),
    ticketNumber: generateTicketNumber(),
    type,
    priority: priority || 'medium',
    status: 'open',
    subject,
    description,
    submittedBy,
    submittedDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    notes: [],
  }
  tickets.unshift(newTicket)
  saveTickets(tickets)
  return newTicket
}

export function updateTicketStatus(ticketId, status) {
  const tickets = getTickets()
  const idx = tickets.findIndex(t => t.id === ticketId)
  if (idx === -1) return null
  tickets[idx].status = status
  tickets[idx].updatedDate = new Date().toISOString()
  saveTickets(tickets)
  return tickets[idx]
}

export function updateTicketPriority(ticketId, priority) {
  const tickets = getTickets()
  const idx = tickets.findIndex(t => t.id === ticketId)
  if (idx === -1) return null
  tickets[idx].priority = priority
  tickets[idx].updatedDate = new Date().toISOString()
  saveTickets(tickets)
  return tickets[idx]
}

export function addTicketNote(ticketId, text, author) {
  const tickets = getTickets()
  const idx = tickets.findIndex(t => t.id === ticketId)
  if (idx === -1) return null
  tickets[idx].notes.push({
    id: Date.now(),
    text,
    author,
    date: new Date().toISOString(),
  })
  tickets[idx].updatedDate = new Date().toISOString()
  saveTickets(tickets)
  return tickets[idx]
}

export function deleteTicket(ticketId) {
  const tickets = getTickets().filter(t => t.id !== ticketId)
  saveTickets(tickets)
}
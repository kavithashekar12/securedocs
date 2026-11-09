
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const users = {
  admin: { password: 'admin123', role: 'Admin' },
  manager: { password: 'manager123', role: 'Manager' },
  employee: { password: 'employee123', role: 'Employee' }
}

const sessions = new Map()

let documents = [
  { id: '1', name: 'Project Proposal.pdf', owner: 'Admin', access: 'Private', data: null },
  { id: '2', name: 'Company Report.docx', owner: 'Manager', access: 'Shared', data: null },
  { id: '3', name: 'Meeting Notes.pdf', owner: 'Admin', access: 'Private', data: null }
]

let auditLogs = []

function logAction(user, action, documentName) {
  auditLogs.unshift({
    id: crypto.randomUUID(),
    user,
    action,
    document: documentName,
    time: new Date().toISOString()
  })
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const user = sessions.get(token)

  if (!user) {
    return res.status(401).json({ error: 'Please log in first.' })
  }

  req.user = user
  next()
}

function canView(user, doc) {
  return user.role === 'Admin' ||
    doc.access === 'Shared' ||
    doc.owner === user.role
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SecureDocs API' })
})

app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  const account = users[username]

  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Invalid username or password.' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const user = { username, role: account.role }

  sessions.set(token, user)
  logAction(username, 'LOGIN', '-')

  res.json({ token, user })
})

app.get('/api/documents', authenticate, (req, res) => {
  const visible = documents
    .filter(doc => canView(req.user, doc))
    .map(({ data, ...doc }) => doc)

  res.json(visible)
})

app.post('/api/documents', authenticate, (req, res) => {
  const { name, data } = req.body

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Document name is required.' })
  }

  if (data && (typeof data !== 'string' || data.length > 10000000)) {
    return res.status(413).json({ error: 'File is too large.' })
  }

  const doc = {
    id: crypto.randomUUID(),
    name: name.slice(0, 200),
    owner: req.user.role,
    access: 'Private',
    data: data || null
  }

  documents.push(doc)
  logAction(req.user.username, 'UPLOAD', doc.name)

  const { data: ignored, ...safeDoc } = doc
  res.status(201).json(safeDoc)
})

app.patch('/api/documents/:id/access', authenticate, (req, res) => {
  const doc = documents.find(item => item.id === req.params.id)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  if (
    req.user.role !== 'Admin' &&
    !(req.user.role === 'Manager' && doc.owner === 'Manager')
  ) {
    return res.status(403).json({ error: 'You cannot change this document access.' })
  }

  const { access } = req.body

  if (!['Private', 'Shared'].includes(access)) {
    return res.status(400).json({ error: 'Invalid access setting.' })
  }

  doc.access = access
  logAction(req.user.username, 'ACCESS_CHANGED_TO_' + access.toUpperCase(), doc.name)

  res.json({ message: 'Access updated.', access: doc.access })
})

app.get('/api/documents/:id/download', authenticate, (req, res) => {
  const doc = documents.find(item => item.id === req.params.id)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  if (!canView(req.user, doc)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  if (!doc.data) {
    return res.status(404).json({
      error: 'No uploaded file is stored for this sample document.'
    })
  }

  logAction(req.user.username, 'DOWNLOAD', doc.name)
  res.json({ name: doc.name, data: doc.data })
})

app.get('/api/audit', authenticate, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required.' })
  }

  res.json(auditLogs)
})

app.post('/api/logout', authenticate, (req, res) => {
  const token = req.headers.authorization.replace('Bearer ', '')
  sessions.delete(token)
  res.json({ message: 'Logged out.' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SecureDocs API running on port ${PORT}`)
})


import { useEffect, useState } from 'react'
import './App.css'

const API = 'https://cautious-umbrella-jj9xgjjjwqgv2pqjg-5000.app.github.dev/api'

function App() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [documents, setDocuments] = useState([])
  const [logs, setLogs] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState('Documents')
  const [loading, setLoading] = useState(false)

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Request failed')
    }

    return result
  }

  async function login(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })

      setToken(result.token)
      setUser(result.user)
      setMessage('Welcome to SecureDocs!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDocuments(currentToken = token) {
    const response = await fetch(`${API}/documents`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Could not load documents')
    }

    setDocuments(result)
  }

  useEffect(() => {
    if (token) {
      loadDocuments().catch(err => setError(err.message))
    }
  }, [token])

  async function uploadDocument(event) {
    const file = event.target.files[0]
    if (!file) return

    setError('')
    setMessage('')

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Please choose a file smaller than 5 MB.')
      }

      const reader = new FileReader()

      reader.onload = async () => {
        try {
          await request('/documents', {
            method: 'POST',
            body: JSON.stringify({
              name: file.name,
              data: reader.result,
            }),
          })

          await loadDocuments()
          setMessage('Document uploaded successfully!')
        } catch (err) {
          setError(err.message)
        }
      }

      reader.readAsDataURL(file)
    } catch (err) {
      setError(err.message)
    }

    event.target.value = ''
  }

  async function toggleAccess(doc) {
    setError('')
    setMessage('')

    try {
      const access =
        doc.access === 'Private' ? 'Shared' : 'Private'

      await request(`/documents/${doc.id}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ access }),
      })

      await loadDocuments()
      setMessage('Document access updated!')
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadLogs() {
    try {
      const result = await request('/audit')
      setLogs(result)
      setPage('Audit Logs')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function downloadDocument(doc) {
    try {
      const result = await request(
        `/documents/${doc.id}/download`
      )

      const link = document.createElement('a')
      link.href = result.data
      link.download = result.name
      link.click()
    } catch (err) {
      setError(err.message)
    }
  }

  async function logout() {
    try {
      await request('/logout', { method: 'POST' })
    } catch {
      // Clear local session even if logout request fails.
    }

    setToken('')
    setUser(null)
    setDocuments([])
    setLogs([])
    setPage('Documents')
    setMessage('You have logged out.')
  }

  if (!user) {
    return (
      <div className="app">
        <main className="main">
          <section className="documents-section">
            <h1>🔐 SecureDocs Login</h1>
            <p>Sign in to manage your documents.</p>

            <form onSubmit={login}>
              <p>
                <input
                  className="search"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </p>

              <p>
                <input
                  className="search"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </p>

              <button
                className="upload-button"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            <p>Admin: admin / admin123</p>
            <p>Manager: manager / manager123</p>
            <p>Employee: employee / employee123</p>

            {error && (
              <p style={{ color: 'red' }}>{error}</p>
            )}

            {message && <p>{message}</p>}
          </section>
        </main>
      </div>
    )
  }

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">🔐 SecureDocs</h2>

        <p className="menu-label">WORKSPACE</p>

        <div
          className={`menu-item ${page === 'Documents' ? 'active' : ''}`}
          onClick={() => setPage('Documents')}
        >
          📁 Documents
        </div>

        <div
          className="menu-item"
          onClick={() => setPage('Access Management')}
        >
          👥 Access Management
        </div>

        <div className="menu-item" onClick={loadLogs}>
          📋 Audit Logs
        </div>

        <div
          className="menu-item"
          onClick={() => setPage('Settings')}
        >
          ⚙️ Settings
        </div>

        <p className="sidebar-footer">
          Secure document management
        </p>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{page}</h1>
            <p>
              Signed in as {user.username} ({user.role})
            </p>
          </div>

          <button
            className="access-button"
            onClick={logout}
          >
            Logout
          </button>
        </header>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p>{message}</p>}

        {page === 'Documents' && (
          <>
            <section className="stats">
              <div className="stat-card">
                <span>Total documents</span>
                <h2>{documents.length}</h2>
              </div>

              <div className="stat-card">
                <span>Private documents</span>
                <h2>
                  {documents.filter(d => d.access === 'Private').length}
                </h2>
              </div>

              <div className="stat-card">
                <span>Shared documents</span>
                <h2>
                  {documents.filter(d => d.access === 'Shared').length}
                </h2>
              </div>
            </section>

            <section className="documents-section">
              <div className="section-heading">
                <div>
                  <h2>Your documents</h2>
                  <p>
                    Only documents you are permitted to view appear here.
                  </p>
                </div>

                <label className="upload-button">
                  + Upload document
                  <input
                    type="file"
                    onChange={uploadDocument}
                    hidden
                  />
                </label>
              </div>

              <input
                className="search"
                placeholder="Search documents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="document-list">
                <div className="document-row table-heading">
                  <span>DOCUMENT NAME</span>
                  <span>OWNER</span>
                  <span>ACCESS</span>
                  <span>ACTION</span>
                </div>

                {filteredDocuments.map(doc => (
                  <div className="document-row" key={doc.id}>
                    <span>📄 {doc.name}</span>
                    <span>{doc.owner}</span>

                    <span
                      className={
                        doc.access === 'Private'
                          ? 'private'
                          : 'shared'
                      }
                    >
                      {doc.access}
                    </span>

                    <span>
                      <button
                        className="access-button"
                        onClick={() => downloadDocument(doc)}
                      >
                        Download
                      </button>

                      {user.role !== 'Employee' && (
                        <button
                          className="access-button"
                          onClick={() => toggleAccess(doc)}
                        >
                          Change access
                        </button>
                      )}
                    </span>
                  </div>
                ))}

                {filteredDocuments.length === 0 && (
                  <p className="empty">No documents found.</p>
                )}
              </div>
            </section>
          </>
        )}

        {page === 'Audit Logs' && (
          <section className="documents-section">
            <h2>Audit Logs</h2>

            {logs.map(log => (
              <p key={log.id}>
                {log.user} — {log.action} — {log.document} —{' '}
                {new Date(log.time).toLocaleString()}
              </p>
            ))}
          </section>
        )}

        {page === 'Access Management' && (
          <section className="documents-section">
            <h2>Access Management</h2>
            <p>
              Permissions are checked by the backend for every document request.
            </p>
            <p>
              Your current role: <strong>{user.role}</strong>
            </p>
          </section>
        )}

        {page === 'Settings' && (
          <section className="documents-section">
            <h2>Settings</h2>
            <p>Signed in as {user.username}</p>
            <p>Role: {user.role}</p>
          </section>
        )}

        <footer>
          SecureDocs © 2026 · Document Access Management
        </footer>
      </main>
    </div>
  )
}

export default App

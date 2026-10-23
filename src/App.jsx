import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import Home from './pages/Home'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center">Loading…</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/chat" /> : <Auth mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/chat" /> : <Auth mode="register" />} />
      <Route path="/chat/:chatId?" element={user ? <Home /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user ? '/chat' : '/login'} />} />
    </Routes>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

export default function Auth({ mode }) {
  const { login, register } = useAuth()
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const reg = mode === 'register'
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const submit = async e => {
    e.preventDefault(); setErr('')
    try { reg ? await register(f.name, f.email, f.password) : await login(f.email, f.password) }
    catch (x) { setErr(x.code?.replace('auth/', '').replace(/-/g, ' ') || 'Something went wrong') }
  }
  return (
    <div className="center">
      <ThemeToggle className="theme-fab" />
      <form className="auth" onSubmit={submit}>
        <h1>Chatly</h1>
        <p>{reg ? 'Create your account' : 'Sign in to continue'}</p>
        {reg && <input placeholder="Display name" value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input type="password" placeholder="Password (6+ characters)" minLength={6} value={f.password} onChange={set('password')} required />
        {err && <div className="err">{err}</div>}
        <button>{reg ? 'Create account' : 'Sign in'}</button>
        <small>{reg ? <>Have an account? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create account</Link></>}</small>
      </form>
    </div>
  )
}

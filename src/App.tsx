import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import AuthCard from './features/auth/AuthCard'
import MainShell from './features/main/MainShell'
import { auth } from './firebase'

const App = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setChecking(false)
    })
    return () => unsub()
  }, [])

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {checking ? (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      ) : user ? (
        <MainShell user={user} />
      ) : (
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <AuthCard />
        </div>
      )}
    </div>
  )
}

export default App

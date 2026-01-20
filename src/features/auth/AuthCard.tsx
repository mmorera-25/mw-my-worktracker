import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../../firebase'

const AuthCard = () => {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong, please try again.'
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card px-12 py-14 shadow-lg">
      <div className="mb-10 space-y-3">
        <p className="text-sm uppercase text-muted-foreground">
          WorkTracker
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground">
          Sign in with Google
        </h1>
        <p className="text-lg text-muted-foreground">
          Use your Google account to access your workspace. We&apos;ll keep you signed in.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-secondary px-4 py-3 text-base font-semibold text-foreground ring-1 ring-inset ring-border transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            width="20"
            height="20"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.3 0 6.2 1.1 8.5 3.2l6.4-6.4C34.7 2 29.7 0 24 0 14.6 0 6.4 5.4 2.6 13.3l7.5 5.8C12 13 17.5 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 2.8-2.2 5.1-4.7 6.6l7.3 5.7c4.2-3.9 7.2-9.7 7.2-16.8z"
            />
            <path
              fill="#FBBC05"
              d="M10.1 28.9c-.5-1.6-.8-3.3-.8-4.9s.3-3.3.8-4.9l-7.5-5.8C.9 15.4 0 19.1 0 23c0 3.9.9 7.6 2.6 10.9l7.5-5z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.5 0 12-2.1 16-5.7l-7.3-5.7c-2 1.3-4.7 2.1-7.6 2.1-6.5 0-12-4.4-13.9-10.4l-7.5 5.8C6.4 42.6 14.6 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </span>
        {submitting ? 'Connecting…' : 'Continue with Google'}
      </button>
    </div>
  )
}

export default AuthCard

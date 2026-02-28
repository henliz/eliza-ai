'use client'

import { useState } from 'react'
import SSOLogin from '@/components/SSOLogin'
import Chat from '@/components/Chat'

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState('')

  return (
    <main className="h-screen w-screen overflow-hidden">
      {!authenticated ? (
        <SSOLogin onLogin={(u) => { setUsername(u); setAuthenticated(true) }} />
      ) : (
        <Chat username={username} />
      )}
    </main>
  )
}

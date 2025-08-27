"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'smartdevbox-chat-v1'
const DARK_KEY = 'smartdevbox-theme'

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState<boolean>(false)
  const [model, setModel] = useState<string>('Local LLM (Ollama)')

  const outputRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Load persisted chat and theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { messages: Message[] }
        setMessages(parsed.messages || [])
      }
    } catch {}
    try {
      const savedTheme = localStorage.getItem(DARK_KEY)
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark
      setDark(initialDark)
      document.documentElement.classList.toggle('dark', initialDark)
    } catch {}
  }, [])

  // Persist chat
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }))
    } catch {}
  }, [messages])

  // Auto scroll
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      document.documentElement.classList.toggle('dark', next)
      try { localStorage.setItem(DARK_KEY, next ? 'dark' : 'light') } catch {}
      return next
    })
  }, [])

  const placeholderResponse = useMemo(() => {
    return '/*\n Demo mode: Local API not connected.\n You can still experience the UI and copy code.\n*/\n\nfunction hello() {\n  console.log("Hello from SmartDevBox Web!")\n}'
  }, [])

  const handleClear = useCallback(() => {
    controllerRef.current?.abort()
    setMessages([])
    setError(null)
    setIsLoading(false)
  }, [])

  const sendPrompt = useCallback(async () => {
    if (!input.trim() || isLoading) return
    setError(null)
    const userMsg: Message = { role: 'user', content: input.trim() }
    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')

    const idx = messages.length + 1 // index of assistant in next state
    setIsLoading(true)
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content }),
        signal: controller.signal,
      })

      // Try streaming text
      const reader = res.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          acc += decoder.decode(value, { stream: true })
          // Many local LLM servers stream NDJSON lines; try to join as text
          const chunkText = acc
          setMessages((prev) => {
            const next = [...prev]
            next[idx] = { role: 'assistant', content: chunkText }
            return next
          })
        }
        // flush
        acc += new TextDecoder().decode()
        setMessages((prev) => {
          const next = [...prev]
          next[idx] = { role: 'assistant', content: acc.trim() || placeholderResponse }
          return next
        })
      } else {
        const text = (await res.text()) || placeholderResponse
        setMessages((prev) => {
          const next = [...prev]
          next[idx] = { role: 'assistant', content: text }
          return next
        })
      }
    } catch (e: any) {
      const text = placeholderResponse
      setMessages((prev) => {
        const next = [...prev]
        next[idx] = { role: 'assistant', content: text }
        return next
      })
      setError('Failed to reach local LLM. Showing demo output.')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, messages.length, placeholderResponse])

  const rendered = useMemo(() => messages.map((m, i) => (
    <div key={i} className={clsx('w-full', m.role === 'user' ? 'justify-end flex' : 'justify-start flex')}>
      <div className={clsx('card w-full md:w-[90%] p-4 whitespace-pre-wrap', m.role === 'user' ? 'bg-slate-50 dark:bg-slate-950' : '')}>
        {m.role === 'assistant' ? (
          <CodeBlock text={m.content} />
        ) : (
          <p className="text-sm leading-relaxed">{m.content}</p>
        )}
      </div>
    </div>
  )), [messages])

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold">SmartDevBox Web</span>
          <select className="input text-xs h-8 w-52" value={model} onChange={(e) => setModel(e.target.value)}>
            <option>Local LLM (Ollama)</option>
            <option>Code-Gen Small</option>
            <option>Code-Gen Large</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={toggleDark} aria-label="Toggle theme">
            {dark ? 'Light' : 'Dark'} mode
          </button>
          <button className="btn btn-ghost text-xs" onClick={handleClear}>Clear Chat</button>
        </div>
      </div>

      <div ref={outputRef} className="flex-1 overflow-auto space-y-3 p-2 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">
            Ask for code, refactors, or fixes. The assistant will stream results here.
          </div>
        )}
        {rendered}
        {isLoading && <LoadingPlaceholder />}
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="flex gap-2">
        <textarea
          className="input min-h-[56px] h-14 resize-y"
          placeholder="Describe the code you want..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendPrompt()
            }
          }}
        />
        <button className="btn btn-primary h-14 shrink-0" onClick={sendPrompt} disabled={isLoading || !input.trim()}>
          {isLoading ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded mb-2"></div>
      <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded mb-2"></div>
      <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded"></div>
    </div>
  )
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const onCopy = async () => {
    const t = preRef.current?.innerText || text
    await copyToClipboard(t)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="relative">
      <button onClick={onCopy} className="absolute right-2 top-2 btn btn-ghost text-xs">
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={preRef} className="overflow-x-auto whitespace-pre rounded-md bg-slate-900 text-slate-100 p-4 text-sm">
{text}
      </pre>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

export default function NarrativeStream({
  systemPrompt,
  prompt,
}: {
  systemPrompt: string
  prompt: string
}) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function stream() {
      try {
        const res = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt, userPrompt: prompt }),
        })
        if (!res.ok) throw new Error(`API error ${res.status}`)

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')
        const decoder = new TextDecoder()

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          setText(prev => prev + decoder.decode(value, { stream: true }))
        }
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    }

    stream()
  }, [systemPrompt, prompt])

  if (error) {
    return (
      <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
        Could not load AI analysis: {error}
      </div>
    )
  }

  return (
    <div>
      <p className="text-stone-700 leading-relaxed whitespace-pre-wrap text-[15px]">
        {text}
        {!done && (
          <span className="inline-block w-2 h-4 bg-stone-400 ml-0.5 animate-pulse align-middle" />
        )}
      </p>
      {!done && !text && (
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <span className="inline-block w-2 h-2 bg-stone-300 rounded-full animate-pulse" />
          Claude is writing your report…
        </div>
      )}
    </div>
  )
}

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(request: Request) {
  const { systemPrompt, userPrompt } = (await request.json()) as {
    systemPrompt: string
    userPrompt: string
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxOutputTokens: 600,
  })

  return result.toTextStreamResponse()
}

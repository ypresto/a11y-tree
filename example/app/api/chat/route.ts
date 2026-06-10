/**
 * Chat route for the in-browser agent.
 *
 * The model runs here (server-side, with your API key), but the tools do NOT:
 * we hand `streamText` the a11y-tree tool *schemas* (no `execute`), so each tool
 * call is streamed to the browser, where the client runs it against the live DOM
 * (see app/page.tsx `onToolCall`) and sends the result back.
 */

import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { createA11yTreeToolSchemas } from '@a11y-tree/ai-sdk';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-5-mini'),
    system: [
      'You are an in-browser assistant that can see and operate the page the user is viewing.',
      'Call browser_snapshot to read the page as an accessibility tree, then act on elements',
      'by their [ref=eN] ids (browser_click, browser_type, browser_fill_form, …).',
      'After an action you get a diff of only what changed; call browser_snapshot when you',
      'need to see the whole page again.',
      'NEVER ask for confirmation or for credentials. If you hit a login wall, ask the user',
      'to sign in manually.',
    ].join('\n'),
    messages: convertToModelMessages(messages),
    // Schemas only — no execute. These become client-side tools.
    tools: createA11yTreeToolSchemas(),
    stopWhen: stepCountIs(20),
  });

  return result.toUIMessageStreamResponse();
}

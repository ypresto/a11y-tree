'use client';

import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useRef, useState } from 'react';
import { createA11yTreeTools } from '@a11y-tree/ai-sdk';

type Tools = ReturnType<typeof createA11yTreeTools>;

export default function Page() {
  const demoRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<Tools | null>(null);
  const [input, setInput] = useState('');
  const [account, setAccount] = useState<string | null>(null);

  // Build the a11y-tree tool set lazily, rooted at the demo panel so the agent
  // sees the form — not the chat UI around it. Runs in the browser on the first
  // tool call, where `document` exists.
  const getTools = (): Tools => {
    if (!toolsRef.current) {
      toolsRef.current = createA11yTreeTools({ root: demoRef.current ?? document.body });
    }
    return toolsRef.current;
  };

  const { messages, sendMessage, addToolResult, status } = useChat({
    // When the model's turn ends with client tool calls, re-send automatically
    // once their results are in so the agent loop continues.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      const tools = getTools();
      const tool = tools[toolCall.toolName as keyof Tools];
      if (!tool?.execute) return;
      // The tool runs here, in the browser, against the live DOM.
      const output = await tool.execute(toolCall.input as never, {
        toolCallId: toolCall.toolCallId,
        messages: [],
      });
      addToolResult({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
    },
  });

  const send = () => {
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <div className="grid h-screen grid-cols-1 gap-4 p-4 md:grid-cols-2">
      {/* LEFT: the page the agent operates on. */}
      <section className="overflow-y-auto rounded-lg border p-6">
        <h2 className="mb-1 text-lg font-semibold">Demo signup form</h2>
        <p className="mb-4 text-sm text-gray-500">
          The agent reads and drives this panel through its accessibility tree. Try asking it to
          fill it in.
        </p>

        <div ref={demoRef}>
          <form
            className="flex max-w-sm flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setAccount(
                `${fd.get('plan')} account created for ${fd.get('name') || '(no name)'} ` +
                  `<${fd.get('email') || 'no-email'}>` +
                  (fd.get('terms') ? '' : ' — but terms were not accepted!'),
              );
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Full name
              <input name="name" aria-label="Full name" className="rounded border p-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input name="email" type="email" aria-label="Email" className="rounded border p-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Plan
              <select name="plan" aria-label="Plan" className="rounded border p-2">
                <option value="Free">Free</option>
                <option value="Pro">Pro</option>
                <option value="Team">Team</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="terms" type="checkbox" aria-label="Accept terms" />
              Accept terms and conditions
            </label>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Create account
            </button>
          </form>

          {account && (
            <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">
              ✓ {account}
            </p>
          )}
        </div>
      </section>

      {/* RIGHT: the conversation. */}
      <section className="flex min-h-0 flex-col rounded-lg border">
        <header className="border-b p-4">
          <h1 className="text-lg font-semibold">a11y-tree in-browser agent</h1>
          <p className="text-sm text-gray-500">
            e.g. &quot;Fill in the form with test data, pick the Pro plan, accept the terms, and
            submit.&quot;
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-gray-400">Ask the agent to operate the form →</p>
          )}
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[90%] rounded-lg p-3 text-sm ${
                  message.role === 'user' ? 'bg-blue-600 text-white' : 'border bg-white'
                }`}
              >
                <div className="mb-1 text-xs font-semibold opacity-70">
                  {message.role === 'user' ? 'You' : 'Agent'}
                </div>
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    );
                  }
                  if (part.type.startsWith('tool-')) {
                    const output =
                      'output' in part && part.output && typeof part.output === 'object'
                        ? (part.output as { snapshot?: string })
                        : null;
                    return (
                      <div key={i} className="mt-1">
                        <div className="font-mono text-xs text-blue-600">🔧 {part.type}</div>
                        {output?.snapshot && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gray-500">
                              snapshot ({output.snapshot.length.toLocaleString()} chars)
                            </summary>
                            <pre className="mt-1 max-h-72 overflow-auto rounded bg-gray-50 p-2 text-xs whitespace-pre-wrap">
                              {output.snapshot}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          {status === 'streaming' && <div className="animate-pulse text-gray-500">Agent is working…</div>}
        </div>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the agent to operate the form…"
            rows={1}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            disabled={status !== 'ready'}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}

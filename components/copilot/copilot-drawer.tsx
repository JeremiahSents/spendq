"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Delete02Icon, SentIcon, SparklesIcon } from "@hugeicons/core-free-icons"

import { BrandLogo } from "@/components/shared/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSpend } from "@/lib/store/spend-store"

import { QUICK_PROMPTS, answer, routeIntent, type Answer, type AnswerTarget, type Intent } from "./answers"

type Message = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; answer: Answer }

const TYPING_MS = 600

export function CopilotDrawer() {
  const { state, setCopilotOpen, openDrawer } = useSpend()
  const router = useRouter()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [typing, setTyping] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  const stateRef = React.useRef(state)
  React.useEffect(() => {
    stateRef.current = state
  }, [state])
  const nextId = React.useRef(1)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, typing])

  const ask = (text: string, intent?: Intent | null) => {
    const question = text.trim()
    if (!question || typing) return
    const resolved = intent === undefined ? routeIntent(question) : intent
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: question }])
    setDraft("")
    setTyping(true)
    timer.current = setTimeout(() => {
      // Computed from the live store at answer time, so approvals change the figures.
      const result = answer(resolved, stateRef.current)
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", answer: result }])
      setTyping(false)
      timer.current = null
    }, TYPING_MS)
  }

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setTyping(false)
    setMessages([])
    setDraft("")
  }

  const go = (target: AnswerTarget) => {
    setCopilotOpen(false)
    if (target.type === "drawer") openDrawer(target.drawer)
    else router.push(target.href)
  }

  return (
    <Sheet open={state.copilotOpen} onOpenChange={setCopilotOpen}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HugeiconsIcon icon={SparklesIcon} size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-semibold">SpendIQ AI</SheetTitle>
              <SheetDescription className="text-xs">Answers are computed from live workspace data</SheetDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} disabled={messages.length === 0 && !typing}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              Clear
            </Button>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && !typing ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask about waste, cloud bills, licenses, procurement or savings. Every figure comes from the current
                workspace state.
              </p>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.intent}
                    type="button"
                    onClick={() => ask(p.prompt, p.intent)}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {p.prompt}
                    <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.text}
                </p>
              </div>
            ) : (
              <AnswerBubble key={m.id} answer={m.answer} onGo={go} onAsk={(q) => ask(q)} disabled={typing} />
            ),
          )}

          {typing ? (
            <div className="flex items-center gap-2" aria-label="SpendIQ AI is typing">
              <BrandLogo brand="SpendIQ" size="sm" />
              <span className="inline-flex gap-1 rounded-lg border px-3 py-2.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t p-3">
          {messages.length > 0 ? (
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.intent}
                  type="button"
                  disabled={typing}
                  onClick={() => ask(p.prompt, p.intent)}
                  className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {p.prompt}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ask(draft)
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about spend, savings or vendors…"
              aria-label="Ask SpendIQ AI"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || typing} aria-label="Send">
              <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AnswerBubble({
  answer,
  onGo,
  onAsk,
  disabled,
}: {
  answer: Answer
  onGo: (target: AnswerTarget) => void
  onAsk: (question: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-2">
      <BrandLogo brand="SpendIQ" size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="text-sm leading-relaxed">{answer.headline}</p>

        {answer.items.length > 0 ? (
          <div className="divide-y overflow-hidden rounded-lg border">
            {answer.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onGo(item.target)}
                className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
              >
                <BrandLogo brand={item.brand} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  {item.detail ? <span className="block truncate text-xs text-muted-foreground">{item.detail}</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                    {item.figure}
                  </span>
                  {item.subFigure ? (
                    <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">{item.subFigure}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground group-hover:text-foreground">Review</span>
              </button>
            ))}
          </div>
        ) : null}

        {answer.suggestions ? (
          <div className="flex flex-col gap-1">
            {answer.suggestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={disabled}
                onClick={() => onAsk(q)}
                className="rounded-md px-2 py-1 text-left text-sm text-primary hover:bg-muted disabled:opacity-50 dark:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        {answer.actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {answer.actions.map((a, i) => (
              <Button
                key={a.href}
                size="sm"
                variant={i === 0 ? "secondary" : "outline"}
                onClick={() => onGo({ type: "link", href: a.href })}
              >
                {a.label}
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}


"use client";

import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Message, MessageContent, MessageResponse } from "./ai-elements/message";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";

const SUGGESTIONS = [
  "Show me low-stock items",
  "What were yesterday's top sellers?",
  "Summarize this week's revenue",
];

const TOOL_LABELS: Record<string, string> = {
  "tool-getSupportTickets": "support tickets",
  "tool-getReturnsHistory": "returns",
  "tool-getInventoryStock": "inventory",
  "tool-getSalesAnalytics": "sales",
  "tool-searchProducts": "catalog",
  "tool-getAllCategories": "categories",
};

type ToolPart = {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function TerminalIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function BashBlock({ part }: { part: ToolPart }) {
  const input = part.input as { command?: string } | undefined;
  const output = part.output as
    | { stdout?: string; stderr?: string; exitCode?: number }
    | undefined;

  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed =
    part.state === "output-error" ||
    (part.state === "output-available" && (output?.exitCode ?? 0) !== 0);

  const label = running ? "Running…" : failed ? "Command failed" : "Terminal";

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 font-mono text-sm">
      <div
        className={`flex items-center gap-2 border-b border-neutral-800 bg-neutral-800/50 px-3 py-2 ${
          failed ? "text-red-400" : "text-neutral-400"
        }`}
      >
        <TerminalIcon />
        <span className="text-xs" aria-live="polite">
          {label}
          {failed && output?.exitCode !== undefined ? ` (exit ${output.exitCode})` : ""}
        </span>
      </div>
      <div className="overflow-x-auto px-3 py-2">
        <div className="font-semibold text-neutral-100">$ {input?.command}</div>
        {part.state === "output-available" && output && (
          <div className="mt-1 text-neutral-300">
            {output.stdout && <pre className="whitespace-pre-wrap">{output.stdout}</pre>}
            {output.stderr && (
              <pre className="whitespace-pre-wrap text-red-400">{output.stderr}</pre>
            )}
          </div>
        )}
        {part.state === "output-error" && (
          <pre className="mt-1 whitespace-pre-wrap text-red-400">
            {part.errorText ?? "The command could not run."}
          </pre>
        )}
        {running && (
          <div className="mt-1 text-neutral-500">
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DataToolChip({ part }: { part: ToolPart }) {
  const label = TOOL_LABELS[part.type] ?? "data";
  const output = part.output as { error?: string } | undefined;

  if (part.state === "output-error" || output?.error) {
    return (
      <div className="my-1 text-xs text-destructive">Couldn’t load {label}.</div>
    );
  }
  if (part.state === "output-available") {
    return <div className="my-1 text-xs text-muted-foreground">Loaded {label}</div>;
  }
  return (
    <div className="my-1 text-xs text-muted-foreground" aria-live="polite">
      Fetching {label}…
    </div>
  );
}

export function AdminAgentChat() {
  const [input, setInput] = useState("");

  const { messages, error, sendMessage, status, stop } = useChat({
    transport: new WorkflowChatTransport({ api: "/api/admin/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (_message: PromptInputMessage) => {
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isBusy) return;
    sendMessage({ text: suggestion });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((m) =>
            m.parts.map((p, i) => {
              const key = `${m.id}-${i}`;
              if (p.type === "text") {
                return (
                  <Message key={key} from={m.role}>
                    <MessageContent>
                      <MessageResponse>{p.text}</MessageResponse>
                    </MessageContent>
                  </Message>
                );
              }
              if (p.type === "tool-bash") {
                return <BashBlock key={key} part={p as unknown as ToolPart} />;
              }
              if (p.type.startsWith("tool-")) {
                return <DataToolChip key={key} part={p as unknown as ToolPart} />;
              }
              return null;
            }),
          )}
          {error && (
            <div
              role="alert"
              className="my-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              Something went wrong. Please try sending your message again.
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-3 border-t p-3">
        <Suggestions>
          {SUGGESTIONS.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} />
          ))}
        </Suggestions>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask the admin agent…"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              status={status}
              onClick={isBusy ? stop : undefined}
              disabled={!isBusy && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import type { ShoppingAgentUIMessage } from "@/lib/agent";
import { AgentProductList } from "./agent-product-list";
import { AgentProductCard } from "./agent-product-card";

export function AgentChat() {
  const [input, setInput] = useState("");

  const activeRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("active-workflow-run-id") ?? undefined;
  }, []);

  const { messages, error, sendMessage, status, stop } =
    useChat<ShoppingAgentUIMessage>({
      resume: Boolean(activeRunId),
      transport: new WorkflowChatTransport({
        api: "/api/chat",
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) localStorage.setItem("active-workflow-run-id", runId);
        },
        onChatEnd: () => localStorage.removeItem("active-workflow-run-id"),
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
          const runId = localStorage.getItem("active-workflow-run-id");
          if (!runId) throw new Error("No active workflow run ID found");
          return { ...rest, api: `/api/chat/${encodeURIComponent(runId)}/stream` };
        },
      }),
    });

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((m) =>
            m.parts.map((p, i) => {
              switch (p.type) {
                case "text":
                  return (
                    <Message key={`${m.id}-${i}`} from={m.role}>
                      <MessageContent>
                        <MessageResponse>{p.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  );
                case "tool-searchProducts":
                  return <AgentProductList key={`${m.id}-${i}`} invocation={p} />;
                case "tool-getProductDetails":
                  return <AgentProductCard key={`${m.id}-${i}`} invocation={p} />;
                default:
                  return null;
              }
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

      <div className="border-t p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask the agent"
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
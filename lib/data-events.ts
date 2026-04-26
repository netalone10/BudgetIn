"use client";

import { useEffect, useRef } from "react";

export type DataTopic = "transactions" | "budget" | "accounts" | "categories";

const EVENT_PREFIX = "budgetin:data:";
const CHANNEL_NAME = "budgetin-data";

let bc: BroadcastChannel | null = null;
let bcInit = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (bcInit) return bc;
  bcInit = true;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    bc = null;
  }
  return bc;
}

export function emitDataChanged(topics: DataTopic | DataTopic[]): void {
  if (typeof window === "undefined") return;
  const list = Array.isArray(topics) ? topics : [topics];
  const ts = Date.now();
  for (const topic of list) {
    window.dispatchEvent(new CustomEvent(EVENT_PREFIX + topic, { detail: { ts } }));
  }
  const channel = getChannel();
  if (channel) {
    try {
      channel.postMessage({ topics: list, ts });
    } catch {
      // ignore
    }
  }
}

export function subscribeDataChanged(
  topics: DataTopic | DataTopic[],
  handler: (topic: DataTopic) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const list = Array.isArray(topics) ? topics : [topics];

  const localHandlers = list.map((topic) => {
    const fn = () => handler(topic);
    window.addEventListener(EVENT_PREFIX + topic, fn);
    return { topic, fn };
  });

  const channel = getChannel();
  const bcHandler = (ev: MessageEvent) => {
    const data = ev.data as { topics?: string[] } | null;
    if (!data?.topics) return;
    for (const t of data.topics) {
      if (list.includes(t as DataTopic)) handler(t as DataTopic);
    }
  };
  if (channel) channel.addEventListener("message", bcHandler);

  return () => {
    for (const { topic, fn } of localHandlers) {
      window.removeEventListener(EVENT_PREFIX + topic, fn);
    }
    if (channel) channel.removeEventListener("message", bcHandler);
  };
}

/**
 * Subscribe component to data change events.
 * Handler runs when any of the topics fire — same tab or other tabs (BroadcastChannel).
 * Use the bool argument inside fetch helpers to skip browser cache (Cache-Control max-age).
 */
export function useDataEvent(
  topics: DataTopic | DataTopic[],
  handler: (topic: DataTopic) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const topicsKey = (Array.isArray(topics) ? topics : [topics]).join(",");

  useEffect(() => {
    return subscribeDataChanged(topics, (topic) => handlerRef.current(topic));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey]);
}

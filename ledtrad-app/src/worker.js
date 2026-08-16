import { buildPushPayload } from "@block65/webcrypto-web-push";

const PENDING_KEY = "pending_queue";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readPendingQueue(env) {
  const raw = await env.LEDTRAD_KV.get(PENDING_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function writePendingQueue(env, queue) {
  await env.LEDTRAD_KV.put(PENDING_KEY, JSON.stringify(queue));
}

async function handleSubscribe(request, env) {
  const { deviceId, subscription } = await request.json();
  if (!deviceId || !subscription || !subscription.endpoint) {
    return jsonResponse({ error: "deviceId and subscription are required" }, 400);
  }
  await env.LEDTRAD_KV.put(`sub:${deviceId}`, JSON.stringify(subscription));
  return jsonResponse({ ok: true });
}

async function handleSchedule(request, env) {
  const item = await request.json();
  if (!item.deviceId || !item.id || !item.dueAt) {
    return jsonResponse({ error: "deviceId, id and dueAt are required" }, 400);
  }
  const queue = await readPendingQueue(env);
  queue.push({
    id: item.id,
    deviceId: item.deviceId,
    dueAt: item.dueAt,
    title: item.title || "Ledtråd",
    body: item.body || "Dags att checka in.",
    url: item.url || "/",
  });
  await writePendingQueue(env, queue);
  return jsonResponse({ ok: true, queued: queue.length });
}

async function handleUnschedule(request, env) {
  const { id } = await request.json();
  const queue = await readPendingQueue(env);
  const next = queue.filter((it) => it.id !== id);
  await writePendingQueue(env, next);
  return jsonResponse({ ok: true, removed: queue.length - next.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/subscribe") {
      return handleSubscribe(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/schedule") {
      return handleSchedule(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/unschedule") {
      return handleUnschedule(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "not found" }, 404);
    }
    // Any other path falls through here only if it didn't match a static
    // asset in public/ (asset-first routing is the wrangler.toml default).
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDuePushes(env));
  },
};

const MAX_PUSH_ATTEMPTS = 3;
const PUSH_RETRY_DELAY_MS = 2 * 60 * 1000;

async function sendDuePushes(env) {
  const queue = await readPendingQueue(env);
  if (queue.length === 0) return;

  const now = new Date().toISOString();
  const due = queue.filter((it) => it.dueAt <= now);
  const notYetDue = queue.filter((it) => it.dueAt > now);
  if (due.length === 0) return;

  const vapid = {
    subject: env.VAPID_SUBJECT || "mailto:hej@example.com",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const retry = [];

  for (const item of due) {
    const attempts = (item.attempts || 0) + 1;
    try {
      const subRaw = await env.LEDTRAD_KV.get(`sub:${item.deviceId}`);
      if (!subRaw) throw new Error("no subscription saved yet for " + item.deviceId);
      const subscription = JSON.parse(subRaw);
      const message = {
        data: { title: item.title, body: item.body, url: item.url, tag: item.id },
      };
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(subscription.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        // Subscription is gone (user uninstalled / revoked) - drop it, retrying won't help.
        await env.LEDTRAD_KV.delete(`sub:${item.deviceId}`);
        continue;
      }
      if (!res.ok) throw new Error("push endpoint returned " + res.status);
      // Sent successfully - don't requeue.
    } catch (err) {
      console.error("push failed for", item.id, "attempt", attempts, err);
      if (attempts < MAX_PUSH_ATTEMPTS) {
        retry.push({ ...item, attempts, dueAt: new Date(Date.now() + PUSH_RETRY_DELAY_MS).toISOString() });
      } else {
        console.error("push permanently failed for", item.id, "after", attempts, "attempts");
      }
    }
  }

  await writePendingQueue(env, notYetDue.concat(retry));
}

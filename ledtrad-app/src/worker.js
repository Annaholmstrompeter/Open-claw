import { DurableObject } from "cloudflare:workers";
import { buildPushPayload } from "@block65/webcrypto-web-push";

const LEGACY_PENDING_KEY = "pending_queue";
const REMINDER_PREFIX = "reminder:";
const MIGRATION_MARKER = "meta:legacy-kv-queue-migrated-v1";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_PUSH_ATTEMPTS = 3;
const PUSH_RETRY_DELAY_MS = 2 * 60 * 1000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function normalizeReminder(item) {
  return {
    id: item.id,
    deviceId: item.deviceId,
    dueAt: item.dueAt,
    title: item.title || "Ledtråd",
    body: item.body || "Dags att checka in.",
    url: item.url || "/",
    attempts: item.attempts || 0,
  };
}

function reminderKey(id) {
  return `${REMINDER_PREFIX}${id}`;
}

function reminderScheduler(env) {
  return env.REMINDER_SCHEDULER.getByName("global");
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
  const dueAt = Date.parse(item.dueAt);
  if (!Number.isFinite(dueAt)) {
    return jsonResponse({ error: "dueAt must be a valid ISO timestamp" }, 400);
  }
  const queued = await reminderScheduler(env).schedule(normalizeReminder(item));
  return jsonResponse({ ok: true, queued });
}

async function handleUnschedule(request, env) {
  const { id } = await request.json();
  if (!id) return jsonResponse({ error: "id is required" }, 400);
  const removed = await reminderScheduler(env).unschedule(id);
  return jsonResponse({ ok: true, removed });
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
    return new Response("Not found", { status: 404 });
  },

  // Durable Object alarms are the primary scheduler. The minute cron remains
  // as a safety net and also wakes the object once after this migration deploy.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(reminderScheduler(env).tick());
  },
};

export class ReminderScheduler extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.migrateLegacyQueue();
      await this.scheduleNextAlarm();
    });
  }

  async schedule(item) {
    await this.ctx.storage.put(reminderKey(item.id), item);
    await this.scheduleNextAlarm();
    const reminders = await this.ctx.storage.list({ prefix: REMINDER_PREFIX });
    return reminders.size;
  }

  async unschedule(id) {
    const removed = await this.ctx.storage.delete(reminderKey(id));
    await this.scheduleNextAlarm();
    return removed ? 1 : 0;
  }

  async tick() {
    return this.dispatchDue();
  }

  async alarm() {
    await this.dispatchDue();
  }

  async migrateLegacyQueue() {
    if (await this.ctx.storage.get(MIGRATION_MARKER)) return;

    const raw = await this.env.LEDTRAD_KV.get(LEGACY_PENDING_KEY);
    if (raw) {
      try {
        const legacyQueue = JSON.parse(raw);
        for (const item of legacyQueue) {
          if (item && item.id && item.deviceId && item.dueAt) {
            await this.ctx.storage.put(reminderKey(item.id), normalizeReminder(item));
          }
        }
      } catch (error) {
        console.error("could not migrate legacy reminder queue", error);
      }
      await this.env.LEDTRAD_KV.delete(LEGACY_PENDING_KEY);
    }

    await this.ctx.storage.put(MIGRATION_MARKER, true);
  }

  async scheduleNextAlarm() {
    const reminders = await this.ctx.storage.list({ prefix: REMINDER_PREFIX });
    let nextAt = null;

    for (const item of reminders.values()) {
      const dueAt = Date.parse(item.dueAt);
      if (Number.isFinite(dueAt) && (nextAt === null || dueAt < nextAt)) {
        nextAt = dueAt;
      }
    }

    if (nextAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    // A tiny floor avoids a tight loop if this runs while a due reminder is
    // still being processed.
    await this.ctx.storage.setAlarm(Math.max(nextAt, Date.now() + 1000));
  }

  async dispatchDue() {
    const reminders = await this.ctx.storage.list({ prefix: REMINDER_PREFIX });
    const now = Date.now();
    let sent = 0;
    let retried = 0;
    let dropped = 0;

    for (const [key, item] of reminders) {
      if (Date.parse(item.dueAt) > now) continue;

      const outcome = await this.deliver(item);
      if (outcome === "sent") {
        await this.ctx.storage.delete(key);
        sent += 1;
        continue;
      }
      if (outcome === "gone") {
        await this.ctx.storage.delete(key);
        dropped += 1;
        continue;
      }

      const attempts = (item.attempts || 0) + 1;
      if (attempts >= MAX_PUSH_ATTEMPTS) {
        console.error("push permanently failed for", item.id, "after", attempts, "attempts");
        await this.ctx.storage.delete(key);
        dropped += 1;
      } else {
        await this.ctx.storage.put(key, {
          ...item,
          attempts,
          dueAt: new Date(Date.now() + PUSH_RETRY_DELAY_MS).toISOString(),
        });
        retried += 1;
      }
    }

    await this.scheduleNextAlarm();
    return { sent, retried, dropped };
  }

  async deliver(item) {
    try {
      const subRaw = await this.env.LEDTRAD_KV.get(`sub:${item.deviceId}`);
      if (!subRaw) throw new Error(`no subscription saved for ${item.deviceId}`);

      const subscription = JSON.parse(subRaw);
      const message = {
        data: { title: item.title, body: item.body, url: item.url, tag: item.id },
      };
      const vapid = {
        subject: this.env.VAPID_SUBJECT || "mailto:hej@example.com",
        publicKey: this.env.VAPID_PUBLIC_KEY,
        privateKey: this.env.VAPID_PRIVATE_KEY,
      };
      const payload = await buildPushPayload(message, subscription, vapid);
      const response = await fetch(subscription.endpoint, payload);

      if (response.status === 404 || response.status === 410) {
        await this.env.LEDTRAD_KV.delete(`sub:${item.deviceId}`);
        return "gone";
      }
      if (!response.ok) throw new Error(`push endpoint returned ${response.status}`);
      return "sent";
    } catch (error) {
      console.error("push failed for", item.id, error);
      return "retry";
    }
  }
}

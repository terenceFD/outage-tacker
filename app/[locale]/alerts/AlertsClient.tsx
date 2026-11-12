"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

// final.pdf §2/§3: /alerts — "Save or remove quartiers, enable push, choose
// light and/or water." Alerts are Web Push (free) — WhatsApp/SMS are paid
// and explicitly out of the MVP. Backed by the `push_subscriptions` table
// (final.pdf §4) via /api/push-subscriptions. Demo quartiers only when
// Supabase is unset.
type SubType = "light" | "water";

interface QuartierOption {
  id: string;
  name: string;
  city: string;
}

interface PushSub {
  id: string;
  quartier_id: string;
  type: SubType;
  endpoint: string;
}

// VAPID public key from the environment (safe to expose)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Convert a base64url VAPID key to the Uint8Array applicationServerKey wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr as unknown as Uint8Array<ArrayBuffer>;
}

function Toggle({
  on,
  color,
  label,
  disabled,
  onChange,
}: {
  on: boolean;
  color: string;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40`}
      style={{ backgroundColor: on ? color : "var(--status-unknown)" }}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function AlertsClient() {
  const t = useTranslations("alerts");
  const [subs, setSubs] = useState<PushSub[]>([]);
  const [quartiers, setQuartiers] = useState<QuartierOption[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>("default");
  const [busyPush, setBusyPush] = useState(false);

  const loadSubs = useCallback(async () => {
    const res = await fetch("/api/push-subscriptions");
    if (res.status === 401) {
      setSignedIn(false);
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as { subscriptions?: PushSub[] };
      setSubs(data.subscriptions ?? []);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [qRes] = await Promise.all([fetch("/api/quartiers"), loadSubs()]);
        const qData = (await qRes.json()) as { quartiers?: QuartierOption[] };
        setQuartiers(qData.quartiers ?? []);
        if (typeof Notification !== "undefined") {
          setPushPermission(Notification.permission);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [loadSubs]);

  const sub = (quartierId: string, type: SubType) =>
    subs.some((s) => s.quartier_id === quartierId && s.type === type);

  /** Ask the browser for a push subscription, then register the alert. */
  const flip = async (quartierId: string, type: SubType) => {
    setBusyPush(true);
    try {
      const turningOn = !sub(quartierId, type);
      if (turningOn) {
        if (
          typeof Notification === "undefined" ||
          !("serviceWorker" in navigator) ||
          !VAPID_PUBLIC_KEY
        ) {
          setSignedIn(signedIn); // no-op; push unsupported shown via permission
          return;
        }
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        if (permission !== "granted") return;

        const reg = await navigator.serviceWorker.ready;
        let pushSub = await reg.pushManager.getSubscription();
        if (!pushSub) {
          pushSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        const json = pushSub.toJSON();
        const res = await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: pushSub.endpoint,
            keys: json.keys,
            quartierId,
            type,
          }),
        });
        if (res.status === 401) setSignedIn(false);
        if (res.ok) await loadSubs();
      } else {
        const targets = subs.filter(
          (s) => s.quartier_id === quartierId && s.type === type,
        );
        const endpoints = [...new Set(targets.map((s) => s.endpoint))];
        let ok = true;
        for (const endpoint of endpoints) {
          const res = await fetch("/api/push-subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint, quartierId, type }),
          });
          if (res.status === 401) setSignedIn(false);
          ok = ok && res.ok;
        }
        // Unsubscribe from push entirely when the last alert goes away
        if (ok && subs.length - targets.length === 0) {
          const reg = await navigator.serviceWorker.ready;
          const pushSub = await reg.pushManager.getSubscription();
          await pushSub?.unsubscribe();
        }
        if (ok) await loadSubs();
      }
    } finally {
      setBusyPush(false);
    }
  };

  const savedQuartiers = quartiers.filter((q) =>
    subs.some((s) => s.quartier_id === q.id),
  );

  const otherQuartiers = quartiers.filter(
    (q) =>
      !savedQuartiers.some((sq) => sq.id === q.id) && !q.city.startsWith("—"),
  );

  const pushUnsupported =
    typeof window !== "undefined" &&
    (!("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC_KEY);

  return (
    <div className="flex flex-col gap-4">
      {!signedIn && (
        <p className="surface-card rounded-lg p-4 text-center text-sm text-muted">
          {t("signInNote")}{" "}
          <Link href="/login" className="text-accent hover:underline">
            {t("signIn")}
          </Link>
        </p>
      )}

      {/* Enable push — browser permission gate (final.pdf: Web Push) */}
      <section aria-labelledby="push-heading">
        <h2
          id="push-heading"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          {t("pushTitle")}
        </h2>
        <div className="surface-card rounded-lg p-4 text-sm">
          {pushUnsupported ? (
            <p className="text-muted">🔒 {t("pushUnsupported")}</p>
          ) : pushPermission === "granted" ? (
            <p className="text-status-ok">🔔 {t("pushEnabled")}</p>
          ) : (
            <p className="text-muted">
              🔕 {t("pushDisabled")}{" "}
              {pushPermission === "denied" && (
                <span className="text-status-out">({t("pushBlocked")})</span>
              )}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">{t("pushNote")}</p>
        </div>
      </section>

      {/* Saved quartiers with per-service toggles */}
      <section aria-labelledby="saved-heading">
        <h2
          id="saved-heading"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          {t("saved")}
        </h2>
        <ul className="surface-card divide-y divide-border rounded-lg px-4">
          {savedQuartiers.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/quartier/${encodeURIComponent(q.name)}`}
                  className="font-medium hover:underline"
                >
                  {q.name}
                </Link>
                <p className="text-sm text-muted">{q.city}</p>
              </div>
              <Toggle
                on={sub(q.id, "light")}
                color="var(--power)"
                label={`${q.name} power`}
                disabled={!signedIn || busyPush}
                onChange={() => void flip(q.id, "light")}
              />
              <Toggle
                on={sub(q.id, "water")}
                color="var(--water)"
                label={`${q.name} water`}
                disabled={!signedIn || busyPush}
                onChange={() => void flip(q.id, "water")}
              />
            </li>
          ))}
          {loaded && signedIn && savedQuartiers.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">
              {t("empty")}
            </li>
          )}
        </ul>
      </section>

      {/* Add quartier — picks from the official list */}
      <section aria-labelledby="add-heading">
        <h2 id="add-heading" className="sr-only">
          {t("add")}
        </h2>
        {signedIn ? (
          <select
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) void flip(id, "light"); // default to power alerts
            }}
            disabled={quartiers.length === 0 || busyPush}
            className="min-h-11 w-full rounded-lg border-2 border-dashed border-border bg-surface px-4 py-3 text-base font-semibold text-accent"
          >
            <option value="">{t("add")}</option>
            {otherQuartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}, {q.city}
              </option>
            ))}
          </select>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-3 text-base font-semibold text-accent"
          >
            {t("add")}
          </Link>
        )}
      </section>
    </div>
  );
}

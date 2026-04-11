"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const u8 = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export type PushStatus = 'unsupported' | 'denied' | 'granted' | 'default' | 'loading';

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('loading');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission as PushStatus);

    // Check existing subscription
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscription(sub);
      });
    });
  }, []);

  const subscribe = async (): Promise<boolean> => {
    try {
      setStatus('loading');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const key  = sub.getKey('p256dh');
      const auth = sub.getKey('auth');

      await supabase.from('push_subscriptions').upsert({
        user_id:  user?.id ?? null,
        endpoint: sub.endpoint,
        p256dh:   btoa(String.fromCharCode(...new Uint8Array(key!))),
        auth:     btoa(String.fromCharCode(...new Uint8Array(auth!))),
      }, { onConflict: 'endpoint' });

      setSubscription(sub);
      setStatus('granted');
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      setStatus('denied');
      return false;
    }
  };

  const unsubscribe = async () => {
    if (!subscription) return;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    setSubscription(null);
    setStatus('default');
  };

  // Helper para enviar desde el cliente (solo para testing)
  const sendTest = async () => {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🍽️ La Cocina',
        body:  '¡Las notificaciones push funcionan!',
        tag:   'test',
        url:   '/',
      }),
    });
  };

  return { status, subscription, subscribe, unsubscribe, sendTest };
}
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../api/client';
import { qk } from '../api/hooks';
import { useOffer, type Offer } from '../store/offer';
import { font, radius, useTheme } from '../theme';
import { Button, T, money } from './ui';

const PAYMENT: Record<string, string> = { cash: 'Naqd', click: 'Click', payme: 'Payme', telegram: 'Telegram' };

/** Kiruvchi taksi buyurtmasi: to'liq ekran, taymer, tebranish. Qabul/rad — REST (atomar qabul backend'da). */
export function OfferOverlay() {
  const offer = useOffer((s) => s.offer);
  // key: har yangi taklifda ichki holat (taymer, xabar) noldan boshlanadi
  return offer ? <OfferBody key={offer.order_id} offer={offer} /> : null;
}

function OfferBody({ offer }: { offer: Offer & { expiresAt: number } }) {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const close = useOffer((s) => s.close);
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000)));
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    Vibration.vibrate([0, 600, 400, 600, 400], true);
    const tick = () => {
      const s = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) close(offer.order_id);
    };
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
      Vibration.cancel();
    };
  }, [offer, close]);

  const accept = async () => {
    setBusy('accept');
    Vibration.cancel();
    try {
      await api(`/orders/${offer.order_id}/accept`, { method: 'PUT' });
      close(offer.order_id);
      await qc.invalidateQueries({ queryKey: qk.driverActive });
      void qc.invalidateQueries({ queryKey: qk.home });
      router.navigate('/taxi');
    } catch (e) {
      setNote(e instanceof ApiError && e.status === 409 ? "Buyurtma boshqa haydovchiga o'tdi yoki bekor qilindi" : e instanceof Error ? e.message : 'Xatolik');
      setTimeout(() => close(offer.order_id), 2500);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      await api(`/orders/${offer.order_id}/reject`, { method: 'PUT', body: { reason: 'Haydovchi rad etdi' } });
    } catch {
      // muddati o'tgan bo'lishi mumkin — baribir yopamiz
    } finally {
      setBusy(null);
      close(offer.order_id);
    }
  };

  const total = offer.timeout || 15;
  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={reject}>
      <SafeAreaView style={[s.wrap, { backgroundColor: t.hero }]}>
        <View style={s.top}>
          <Text style={s.kicker}>Yangi buyurtma</Text>
          <Text style={s.price}>{money(offer.price)}</Text>
          <Text style={s.meta}>
            {[`${Number(offer.distance_km).toFixed(1)} km`, offer.duration_min ? `~${offer.duration_min} daq` : null,
              PAYMENT[offer.payment_method] ?? offer.payment_method, `★ ${Number(offer.passenger_rating).toFixed(1)}`]
              .filter(Boolean).join(' · ')}
          </Text>
          <View style={s.timer}>
            <View style={[s.timerFill, { width: `${(left / total) * 100}%` }]} />
          </View>
          <Text style={s.left}>{left} s</Text>
        </View>
        <View style={[s.sheet, { backgroundColor: t.bg }]}>
          <View style={{ gap: 4 }}>
            <T kind="label">Qayerdan</T>
            <T kind="h2">{offer.pickup.address}</T>
            {offer.distance_to_pickup_km != null ? (
              <T kind="muted">Sizdan {Number(offer.distance_to_pickup_km).toFixed(1)} km</T>
            ) : null}
          </View>
          <View style={{ gap: 4 }}>
            <T kind="label">Qayerga</T>
            <T kind="h2">{offer.dropoff.address}</T>
          </View>
          {note ? <T color={t.redInk}>{note}</T> : null}
          <View style={{ flex: 1 }} />
          <Button title="Qabul qilish" icon="check" loading={busy === 'accept'} disabled={!!busy || !!note} onPress={accept} style={{ height: 60 }} />
          <Button title="Rad etish" kind="danger" loading={busy === 'reject'} disabled={!!busy} onPress={reject} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  top: { padding: 24, gap: 6, alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.8)', fontFamily: font.bold, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  price: { color: '#fff', fontFamily: font.heavy, fontSize: 40 },
  meta: { color: 'rgba(255,255,255,0.85)', fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
  timer: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 14, overflow: 'hidden' },
  timerFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  left: { color: '#fff', fontFamily: font.bold, fontSize: 14 },
  sheet: { flex: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, gap: 18 },
});

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../api/client';
import { qk } from '../api/hooks';
import { useOffer, type Offer } from '../store/offer';
import { font, useTheme } from '../theme';
import { Button, Icon, RouteCard, SwipeButton, T, money } from './ui';

const PAYMENT: Record<string, string> = { cash: 'Naqd pul', click: 'Click', payme: 'Payme', telegram: 'Telegram' };
const R = 28;
const CIRC = 2 * Math.PI * R;
const fmtKm = (v: number) => `${v.toFixed(1).replace('.', ',')} km`;
// Shahar ichida ~25 km/soat, yo'l to'g'ri chiziqdan ~1,4 marta uzun
const etaMin = (k: number) => Math.max(1, Math.round((k * 1.4) / 25 * 60));

/** Kiruvchi taksi buyurtmasi — dizayndagi xarita ustidagi karta: narx, taymer halqasi, yo'nalish. Qabul/o'tkazish — REST. */
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
  const toPickup = offer.distance_to_pickup_km;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={reject}>
      <View style={s.backdrop}>
        <SafeAreaView edges={['bottom']} style={{ padding: 12 }}>
          <View style={[s.card, { backgroundColor: t.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 4, flex: 1 }}>
                <View style={[s.chip, { backgroundColor: t.primary }]}><Text style={[s.chipText, { color: t.onPrimary }]}>YANGI BUYURTMA</Text></View>
                <Text style={[s.price, { color: t.text }]}>{money(offer.price)}</Text>
                <Text style={[s.meta, { color: t.muted }]}>
                  {[offer.tariff_name, PAYMENT[offer.payment_method] ?? offer.payment_method].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={s.ring} accessibilityLabel={`Qabul qilish uchun ${left} soniya qoldi`}>
                <Svg width={64} height={64} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
                  <Circle cx={32} cy={32} r={R} fill="none" stroke={t.fill} strokeWidth={6} />
                  <Circle cx={32} cy={32} r={R} fill="none" stroke={t.ink} strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={`${CIRC}`} strokeDashoffset={CIRC * (1 - left / total)} transform="rotate(-90 32 32)" />
                </Svg>
                <Text style={[s.left, { color: t.text }]}>{left}</Text>
              </View>
            </View>

            <RouteCard
              from={offer.pickup.address}
              fromSub={toPickup != null ? `Sizdan ${fmtKm(Number(toPickup))} · ${etaMin(Number(toPickup))} daq` : undefined}
              to={offer.dropoff.address}
              toSub={`Safar ${fmtKm(Number(offer.distance_km))}${offer.duration_min ? ` · ${offer.duration_min} daq` : ''}`}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon n="star" filled size={16} color={t.muted} />
              <Text style={[s.meta, { color: t.muted }]}>Yo‘lovchi reytingi {Number(offer.passenger_rating).toFixed(1).replace('.', ',')}</Text>
            </View>

            {note ? <T color={t.redInk}>{note}</T> : null}

            {/* Qabul — chapdan o'ngga surib (cho'ntakda tasodifan bosilib ketmasin) */}
            <SwipeButton title="Qabul qilish uchun suring" loading={busy === 'accept'} disabled={!!busy || !!note} onSwipe={accept} />
            <Button title="O‘tkazib yuborish" kind="ghost" loading={busy === 'reject'} disabled={!!busy} onPress={reject}
              style={{ height: 44 }} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  card: { borderRadius: 28, padding: 20, gap: 16, elevation: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 32 },
  chip: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontFamily: font.heavy, fontSize: 12, letterSpacing: 0.5 },
  price: { fontFamily: font.heavy, fontSize: 36, letterSpacing: -1.1 },
  meta: { fontFamily: font.medium, fontSize: 14 },
  ring: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  left: { fontFamily: font.heavy, fontSize: 20 },
});

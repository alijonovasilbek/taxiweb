/**
 * Bosh sahifa — Web App dizayni (passenger-app Home: .home-*): bordo sarlavha, sariq "Taksi" kartasi,
 * Po'puti / Yuk tashish plitkalari, Maxsus texnika; qo'shimcha — saqlangan va oxirgi manzillar (bir bosishda taksi).
 */
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  recentPlaces, useActiveOrder, useBookings, useCatalog, useMe, useMyRequests, useRides, useUnread, type SavedPlace,
} from '../../api/hooks';
import { MapWarmup } from '../../components/MapView';
import { Badge, Glass, GlassIcon, Icon, T } from '../../components/ui';
import { BOOKING_STATUS, fmtDateTime, ORDER_STATUS, REQUEST_STATUS } from '../../lib/format';
import { font, useTheme } from '../../theme';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const active = useActiveOrder();
  const unread = useUnread();
  const catalog = useCatalog();
  const rides = useRides();
  const requests = useMyRequests();
  const bookings = useBookings();
  const [refreshing, setRefreshing] = useState(false);

  // Bordo sarlavha ustida holat qatori oq; boshqa ekranlarga o'tilganda mavzuga qaytadi
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(t.scheme === 'dark' ? 'light' : 'dark');
  }, [t.scheme]));

  const on = (code: string) => !catalog.data || catalog.data.services.some((s) => s.code === code && s.is_active);
  const openReqs = (requests.data ?? []).filter((r) => ['open', 'assigned', 'in_progress'].includes(r.status));
  const openBookings = (bookings.data ?? []).filter((b) => ['pending', 'confirmed'].includes(b.status));
  const order = active.data;
  const saved = me.data?.saved_places ?? {};
  const recent = recentPlaces(rides.data, 3);

  const goTaxi = (to?: SavedPlace) => {
    if (order) return router.push({ pathname: '/ride/[id]', params: { id: String(order.id) } });
    router.push(to ? { pathname: '/taxi', params: { to_lat: String(to.lat), to_lng: String(to.lng), to_address: to.address } } : '/taxi');
  };

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.hBg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[t.primary]} progressViewOffset={insets.top} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.hero, { backgroundColor: t.hHero, paddingTop: insets.top + 14 }]}>
          <View style={s.heroTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.logo}><Text style={[s.logoText, { color: t.hHero }]}>C</Text></View>
              <Text style={s.brand}>CHORTOQ SERVICES</Text>
            </View>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
              <Glass onColor rounded={21} style={s.bell}><Icon n="bell" size={20} color="#fff" /></Glass>
              {unread.data?.unread ? (
                <View style={s.dot}><Text style={s.dotText}>{unread.data.unread > 99 ? '99+' : unread.data.unread}</Text></View>
              ) : null}
            </Pressable>
          </View>
          <Text style={s.hello} numberOfLines={1}>Salom, {me.data?.first_name || 'mehmon'}</Text>
          <Pressable onPress={() => router.push('/search')} style={[s.search, { backgroundColor: t.hSearch }]}>
            <Icon n="search" size={18} color={t.hSearchText} />
            <Text style={[s.searchText, { color: t.hSearchText }]} numberOfLines={1}>Labo, ekskavator, Namangan…</Text>
          </Pressable>
        </View>

        <View style={s.content}>
          {order ? (
            <Pressable onPress={() => goTaxi()} style={[s.active, { backgroundColor: t.card, borderLeftColor: t.primary }]}>
              <GlassIcon n="taxi" size={40} color={t.taxi} ink="#141414" iconSize={21} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T style={{ fontFamily: font.bold }}>Faol taksi</T>
                  <Badge text={ORDER_STATUS[order.status]?.text ?? order.status} tone={ORDER_STATUS[order.status]?.tone ?? 'brand'} />
                </View>
                <T kind="small" numberOfLines={1}>{order.pickup_address} → {order.dropoff_address}</T>
              </View>
              <Icon n="next" size={18} color={t.faint} />
            </Pressable>
          ) : null}

          {on('taxi') ? (
            <Pressable onPress={() => goTaxi()} style={({ pressed }) => [s.taxi, { backgroundColor: t.taxi }, pressed && s.pressed]}>
              <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(120,80,0,0.08)']}
                locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
              <View style={s.taxiArt} pointerEvents="none"><Icon n="taxi" size={160} color={t.taxiArt} /></View>
              <View style={s.taxiGo}>
                <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} />
                <Icon n="arrowUR" size={22} color={t.taxi} />
              </View>
              <Text style={s.taxiTitle}>Taksi</Text>
              <Text style={s.taxiSub}>Qayerga boramiz?</Text>
            </Pressable>
          ) : null}

          {on('taxi') ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <PlaceChip icon="home" label={saved.home ? 'Uyga' : "Uy qo'shish"} onPress={() => (saved.home ? goTaxi(saved.home) : router.push('/places'))} />
              <PlaceChip icon="briefcase" label={saved.work ? 'Ishga' : "Ish qo'shish"} onPress={() => (saved.work ? goTaxi(saved.work) : router.push('/places'))} />
              {recent.map((p) => (
                <PlaceChip key={p.address} icon="history" label={p.address} onPress={() => goTaxi(p)} />
              ))}
            </ScrollView>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {on('carpool') ? (
              <Tile title="Po'puti" text="Doimiy qatnov, bo'sh o'rinlarni baham ko'rish" icon="carpool"
                bg={t.tileGreen} ic={t.tileGreenIc} border={t.tileBorder} onPress={() => router.push('/carpool')} />
            ) : null}
            {on('cargo') ? (
              <Tile title="Yuk tashish" text="Labo, Gazel, Isuzu va boshqalar bilan yuk tashish" icon="truck"
                bg={t.tileBlue} ic={t.tileBlueIc} border={t.tileBorder}
                onPress={() => router.push({ pathname: '/request/new', params: { service: 'cargo' } })} />
            ) : null}
          </View>

          {on('equipment') ? (
            <Pressable onPress={() => router.push({ pathname: '/request/new', params: { service: 'equipment' } })}
              style={({ pressed }) => [s.equip, { backgroundColor: t.equip, borderColor: t.tileBorder }, pressed && s.pressed]}>
              <Glass onColor rounded={15} style={s.equipIc}><Icon n="equipment" size={24} color={t.equipIc} /></Glass>
              <View style={{ flex: 1 }}>
                <Text style={[s.equipTitle, { color: t.equipText }]}>Maxsus texnika</Text>
                <Text style={[s.equipSub, { color: t.equipSub }]}>Ekskavator va boshqa texnikalar</Text>
              </View>
              <Icon n="arrowUR" size={21} color={t.equipIc} />
            </Pressable>
          ) : null}

          {openReqs.length || openBookings.length ? <T kind="label" style={{ marginTop: 8 }}>Faol buyurtmalarim</T> : null}
          {openReqs.slice(0, 3).map((r) => (
            <Pressable key={`r${r.id}`} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })}
              style={[s.item, { backgroundColor: t.card }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T style={{ fontFamily: font.bold, flex: 1 }} numberOfLines={1}>{r.title || (r.service_type === 'cargo' ? 'Yuk tashish' : 'Maxsus texnika')}</T>
                <Badge text={REQUEST_STATUS[r.status]?.text ?? r.status} tone={REQUEST_STATUS[r.status]?.tone ?? 'neutral'} />
              </View>
              <T kind="small" numberOfLines={1}>{r.from_address}{r.to_address ? ` → ${r.to_address}` : ''}</T>
              {r.status === 'open' ? <T kind="small" color={t.primary}>{r.offers_count || 0} ta taklif</T> : null}
            </Pressable>
          ))}
          {openBookings.slice(0, 2).map((b) => (
            <Pressable key={`b${b.id}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(b.trip_id) } })}
              style={[s.item, { backgroundColor: t.card }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ fontFamily: font.bold }}>Po'puti · {fmtDateTime(b.departure_at)}</T>
                <Badge text={BOOKING_STATUS[b.status]?.text ?? b.status} tone={BOOKING_STATUS[b.status]?.tone ?? 'neutral'} />
              </View>
              <T kind="small" numberOfLines={1}>{b.from_address} → {b.to_address}</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {/* Xarita skriptlarini oldindan keshga yuklaydi — "Taksi" bosilganda xarita darhol chiqadi */}
      <MapWarmup />
    </View>
  );
}

function PlaceChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Glass strong rounded={22} style={[s.chip, { borderColor: t.line }]}>
        <Icon n={icon} size={17} color={t.primary} />
        <Text style={[s.chipText, { color: t.text }]} numberOfLines={1}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

function Tile({ title, text, icon, bg, ic, border, onPress }: {
  title: string; text: string; icon: string; bg: string; ic: string; border: string; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, { backgroundColor: bg, borderColor: border }, pressed && s.pressed]}>
      <LinearGradient pointerEvents="none" colors={[t.scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} locations={[0, 0.6]}
        style={StyleSheet.absoluteFill} />
      <GlassIcon n={icon} size={44} color={ic} iconSize={23} />
      <View style={{ flex: 1 }} />
      <Text style={[s.tileTitle, { color: t.text }]}>{title}</Text>
      <Text style={[s.tileText, { color: t.muted }]} numberOfLines={3}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 56, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: font.heavy, fontSize: 19 },
  brand: { color: '#fff', fontFamily: font.heavy, fontSize: 13, letterSpacing: 1.3 },
  bell: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ffc72c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#141414', fontFamily: font.bold, fontSize: 10 },
  hello: { color: '#fff', fontFamily: font.heavy, fontSize: 31, letterSpacing: -0.6, marginTop: 22, marginBottom: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchText: { fontFamily: font.medium, fontSize: 15, flex: 1 },
  content: { marginTop: -34, paddingHorizontal: 16, gap: 12 },
  pressed: { transform: [{ scale: 0.98 }] },
  active: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, borderLeftWidth: 4, elevation: 3 },
  taxi: { borderRadius: 24, minHeight: 176, padding: 20, paddingBottom: 18, justifyContent: 'flex-end', overflow: 'hidden', elevation: 6, shadowColor: '#785000' },
  taxiArt: { position: 'absolute', right: -14, bottom: -40 },
  taxiGo: { position: 'absolute', top: 18, right: 18, width: 46, height: 46, borderRadius: 23, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  taxiTitle: { color: '#141414', fontFamily: font.heavy, fontSize: 36, letterSpacing: -0.7, position: 'absolute', top: 18, left: 20 },
  taxiSub: { color: '#141414', fontFamily: font.semibold, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 42, maxWidth: 220 },
  chipText: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  tile: { flex: 1, borderRadius: 22, padding: 16, minHeight: 156, borderWidth: 1, overflow: 'hidden' },
  tileTitle: { fontFamily: font.heavy, fontSize: 18, marginTop: 18 },
  tileText: { fontFamily: font.medium, fontSize: 13, lineHeight: 17, marginTop: 4 },
  equip: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 18, borderWidth: 1, overflow: 'hidden' },
  equipIc: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  equipTitle: { fontFamily: font.heavy, fontSize: 17 },
  equipSub: { fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  item: { borderRadius: 18, padding: 14, gap: 4 },
});

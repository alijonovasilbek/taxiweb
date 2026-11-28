/**
 * Bosh sahifa — "Xizmatlar" dizayni: salomlashuv va joylashuv, bordo "Taksi" kartasi, tezkor manzillar,
 * Po'putchi / Yuk tashish plitkalari, Maxsus texnika; pastda faol buyurtmalar.
 */
import { useQueryClient } from '@tanstack/react-query';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  recentPlaces, useActiveOrder, useBookings, useCatalog, useHere, useMe, useMyRequests, useRides, useUnread, type SavedPlace,
} from '../../api/hooks';
import { MapWarmup } from '../../components/MapView';
import { Badge, Icon, IconTile, T, TAB_SPACE } from '../../components/ui';
import { BOOKING_STATUS, fmtDateTime, greeting, ORDER_STATUS, REQUEST_STATUS } from '../../lib/format';
import { font, useTheme } from '../../theme';


export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const here = useHere();
  const active = useActiveOrder();
  const unread = useUnread();
  const catalog = useCatalog();
  const rides = useRides();
  const requests = useMyRequests();
  const bookings = useBookings();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    setStatusBarStyle(t.scheme === 'dark' ? 'light' : 'dark');
  }, [t.scheme]));

  const on = (code: string) => !catalog.data || catalog.data.services.some((s) => s.code === code && s.is_active);
  const openReqs = (requests.data ?? []).filter((r) => ['open', 'assigned', 'in_progress'].includes(r.status));
  const openBookings = (bookings.data ?? []).filter((b) => ['pending', 'confirmed'].includes(b.status));
  const order = active.data;
  const saved = me.data?.saved_places ?? {};
  const recent = recentPlaces(rides.data, 3);
  const eta = here.data?.eta_min;

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
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 24 + TAB_SPACE, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[t.primary]} progressViewOffset={insets.top} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Salomlashuv · joylashuv · bildirishnoma va profil */}
        <View style={s.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.hello, { color: t.muted }]}>{greeting()}{me.data?.first_name ? `, ${me.data.first_name}` : ''}</Text>
            <Pressable onPress={() => goTaxi()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon n="pin" size={18} color={t.primary} />
              <Text style={[s.place, { color: t.text }]} numberOfLines={1}>{here.data?.place || 'Chortoq'}</Text>
              <Icon n="chevDown" size={14} color={t.text} />
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={[s.round, { backgroundColor: t.card, borderColor: t.line }]} hitSlop={6}>
            <Icon n="bell" size={21} />
            {unread.data?.unread ? (
              <View style={[s.dot, { backgroundColor: t.primary, borderColor: t.bg }]}>
                <Text style={s.dotText}>{unread.data.unread > 99 ? '99+' : unread.data.unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} style={[s.round, { backgroundColor: t.card, borderColor: t.line }]} hitSlop={6}>
            <Icon n="profile" size={22} />
          </Pressable>
        </View>

        {order ? (
          <Pressable onPress={() => goTaxi()} style={[s.active, { backgroundColor: t.ink }]}>
            <IconTile n="taxi" bg={t.primary} color="#fff" size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.activeTitle, { color: t.onInk }]}>{ORDER_STATUS[order.status]?.text ?? 'Faol taksi'}</Text>
              <Text style={[s.activeSub, { color: t.onInk }]} numberOfLines={1}>{order.pickup_address} → {order.dropoff_address}</Text>
            </View>
            <Icon n="next" size={18} color={t.onInk} />
          </Pressable>
        ) : null}

        {on('taxi') ? (
          <Pressable onPress={() => goTaxi()} style={({ pressed }) => [s.taxi, { backgroundColor: t.primary }, pressed && s.pressed]}>
            <View style={s.taxiArt} pointerEvents="none"><TaxiArt color={t.onPrimary} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 6 }}>
                <Text style={[s.taxiTitle, { color: t.onPrimary }]}>Taksi</Text>
                {eta ? (
                  <View style={s.etaChip}><Text style={[s.etaText, { color: t.onPrimary }]}>{eta} daqiqada yetib keladi</Text></View>
                ) : null}
              </View>
              <View style={s.taxiGo}><Icon n="arrowUR" size={20} color="#141414" /></View>
            </View>
            <Text style={[s.taxiSub, { color: t.onPrimary }]}>Qayerga boramiz?</Text>
          </Pressable>
        ) : null}

        {on('taxi') ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            <PlaceChip icon="home" label={saved.home ? 'Uy' : "Uy qo'shish"} onPress={() => (saved.home ? goTaxi(saved.home) : router.push('/places'))} />
            <PlaceChip icon="briefcase" label={saved.work ? 'Ish' : "Ish qo'shish"} onPress={() => (saved.work ? goTaxi(saved.work) : router.push('/places'))} />
            {recent.map((p) => (
              <PlaceChip key={p.address} icon="clock" label={p.address} onPress={() => goTaxi(p)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {on('carpool') ? (
            <Tile title="Po'putchi" text="Doimiy qatnov, bo'sh o'rinlarni baham ko'rish" icon="carpool"
              ic={t.greenInk} icBg={t.greenSoft} onPress={() => router.push('/carpool')} />
          ) : null}
          {on('cargo') ? (
            <Tile title="Yuk tashish" text="Labo, Gazel, Isuzu va boshqalar" icon="truck" ic={t.blueInk} icBg={t.blueSoft}
              onPress={() => router.push({ pathname: '/request/new', params: { service: 'cargo' } })} />
          ) : null}
        </View>

        {on('equipment') ? (
          <Pressable onPress={() => router.push({ pathname: '/request/new', params: { service: 'equipment' } })}
            style={({ pressed }) => [s.wide, { backgroundColor: t.card, borderColor: t.lineSoft }, pressed && s.pressed]}>
            <IconTile n="equipment" size={48} iconSize={24} bg={t.orangeSoft} color={t.orangeInk} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.tileTitle, { color: t.text }]}>Maxsus texnika</Text>
              <Text style={[s.tileText, { color: t.muted }]}>Ekskavator, kran va boshqa texnikalar</Text>
            </View>
            <Icon n="next" size={18} color={t.muted} />
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/search')}
          style={({ pressed }) => [s.wide, { backgroundColor: t.card, borderColor: t.lineSoft }, pressed && s.pressed]}>
          <IconTile n="search" size={48} iconSize={22} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.tileTitle, { color: t.text }]}>Qidiruv</Text>
            <Text style={[s.tileText, { color: t.muted }]}>Ijrochi, qatnov yoki texnikani toping</Text>
          </View>
          <Icon n="next" size={18} color={t.muted} />
        </Pressable>

        {openReqs.length || openBookings.length ? <T kind="label" style={{ marginTop: 6 }}>Faol buyurtmalarim</T> : null}
        {openReqs.slice(0, 3).map((r) => (
          <Pressable key={`r${r.id}`} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(r.id) } })}
            style={[s.item, { backgroundColor: t.card, borderColor: t.lineSoft }]}>
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
            style={[s.item, { backgroundColor: t.card, borderColor: t.lineSoft }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={{ fontFamily: font.bold }}>Po'putchi · {fmtDateTime(b.departure_at)}</T>
              <Badge text={BOOKING_STATUS[b.status]?.text ?? b.status} tone={BOOKING_STATUS[b.status]?.tone ?? 'neutral'} />
            </View>
            <T kind="small" numberOfLines={1}>{b.from_address} → {b.to_address}</T>
          </Pressable>
        ))}
      </ScrollView>
      {/* Xarita skriptlarini oldindan keshga yuklaydi — "Taksi" bosilganda xarita darhol chiqadi */}
      <MapWarmup />
    </View>
  );
}

/** Kartadagi yarim shaffof taksi chizmasi (dizayndagi kontur mashina) */
function TaxiArt({ color }: { color: string }) {
  return (
    <Svg width={210} height={150} viewBox="0 0 210 150" fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={12}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M78 30h54v-18H78z" />
      <Path d="M30 92l18-44q4-10 16-10h82q12 0 16 10l18 44" />
      <Path d="M14 92h182v40H14z" />
      <Path d="M50 132v12M160 132v12" />
      <Circle cx={52} cy={112} r={6} />
      <Circle cx={158} cy={112} r={6} />
    </Svg>
  );
}

function PlaceChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, { backgroundColor: t.card, borderColor: t.line }, pressed && { opacity: 0.7 }]}>
      <Icon n={icon} size={18} color={t.text} />
      <Text style={[s.chipText, { color: t.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Tile({ title, text, icon, ic, icBg, onPress }: {
  title: string; text: string; icon: string; ic: string; icBg: string; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, { backgroundColor: t.card, borderColor: t.lineSoft }, pressed && s.pressed]}>
      <IconTile n={icon} size={48} iconSize={24} bg={icBg} color={ic} />
      <View style={{ gap: 4 }}>
        <Text style={[s.tileTitle, { color: t.text }]}>{title}</Text>
        <Text style={[s.tileText, { color: t.muted }]} numberOfLines={3}>{text}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  hello: { fontFamily: font.medium, fontSize: 14 },
  place: { fontFamily: font.heavy, fontSize: 18, flexShrink: 1 },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  dotText: { color: '#fff', fontFamily: font.bold, fontSize: 10 },
  pressed: { transform: [{ scale: 0.98 }] },
  active: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 14 },
  activeTitle: { fontFamily: font.bold, fontSize: 16 },
  activeSub: { fontFamily: font.medium, fontSize: 13, opacity: 0.75 },
  taxi: { height: 176, borderRadius: 28, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  taxiArt: { position: 'absolute', right: -36, bottom: -22 },
  taxiTitle: { fontFamily: font.heavy, fontSize: 34, letterSpacing: -1 },
  etaChip: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center' },
  etaText: { fontFamily: font.semibold, fontSize: 13 },
  taxiGo: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  taxiSub: { fontFamily: font.semibold, fontSize: 17 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, height: 44, maxWidth: 230 },
  chipText: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  tile: { flex: 1, height: 168, borderRadius: 24, padding: 16, borderWidth: 1, justifyContent: 'space-between' },
  tileTitle: { fontFamily: font.heavy, fontSize: 17 },
  tileText: { fontFamily: font.medium, fontSize: 13, lineHeight: 17 },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, padding: 16, borderWidth: 1 },
  item: { borderRadius: 20, padding: 14, gap: 4, borderWidth: 1 },
});

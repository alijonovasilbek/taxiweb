import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import YandexMap from '../../components/Map/YandexMap';
import MapSearch from '../../components/Map/MapSearch';
import { useLocation } from '../../hooks/useLocation';
import { useOrderStore } from '../../store/orderStore';
import api from '../../services/api';
import { formatPrice, formatDistance, formatDuration, apiError } from '../../utils/formatters';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

const RECENT_KEY = 'cs_recent_places';
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const saveRecent = (place) => {
  try {
    const list = [place, ...loadRecent().filter((p) => p.address !== place.address)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
};
// Manzil topilmasa koordinata emas, tushunarli matn
const nameOf = (data) => data?.address || 'Xaritada belgilangan nuqta';
const fmtKm = (km) => (km === undefined || km === null ? '' : km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Naqd', icon: 'cash' },
  { id: 'payme', label: 'Payme', icon: 'card' },
  { id: 'click', label: 'Click', icon: 'card' },
  { id: 'telegram', label: 'Telegram', icon: 'send' },
];

export default function BookRide() {
  const navigate = useNavigate();
  const { location: myLocation, error: locError } = useLocation();
  const { createOrder } = useOrderStore();
  const toast = useAppStore((s) => s.toast);
  const { user, setUser } = useUserStore();
  const places = user?.saved_places || {};

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [suggests, setSuggests] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [route, setRoute] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('pickup');
  // Markaziy pin (Yandex Go uslubi): qaysi nuqta xarita markazi bilan tanlanmoqda
  const [pinFor, setPinFor] = useState('pickup');
  const [moving, setMoving] = useState(false);
  const [pinTitle, setPinTitle] = useState('');
  const [focus, setFocus] = useState(null);
  const skipCenterUntil = useRef(0);
  const geoReq = useRef(0);

  const flyTo = (loc, skip = true) => {
    if (skip) skipCenterUntil.current = Date.now() + 1500;
    setFocus({ ...loc, ts: Date.now() });
  };

  // Pin ostidagi nuqta: koordinatani saqlab, manzil nomini aniqlaymiz (eski so'rov javobi e'tiborsiz)
  const pinUpdate = async (loc, type = pinFor) => {
    if (!type) return;
    const id = ++geoReq.current;
    if (type === 'pickup') setPickup(loc); else setDropoff(loc);
    setPinTitle('');
    try {
      const { data } = await api.get('/maps/reverse-geocode', { params: loc });
      if (id !== geoReq.current) return;
      setPinTitle(data?.title || nameOf(data));
      if (type === 'pickup') setPickupAddress(nameOf(data)); else setDropoffAddress(nameOf(data));
    } catch {
      if (id !== geoReq.current) return;
      setPinTitle(nameOf(null));
      if (type === 'pickup') setPickupAddress(nameOf(null)); else setDropoffAddress(nameOf(null));
    }
  };

  const handleCenterChange = (loc) => {
    setMoving(false);
    if (!pinFor || Date.now() < skipCenterUntil.current) return;
    pinUpdate(loc);
  };
  const handleMoveStart = () => { if (pinFor && Date.now() >= skipCenterUntil.current) setMoving(true); };

  const locateMe = () => {
    if (!myLocation) return;
    flyTo(myLocation);
    if (pinFor) pinUpdate(myLocation);
  };

  // Joylashuv berilmasa (ruxsat yo'q) — pin Chortoq markazidagi nuqtani oladi
  useEffect(() => {
    if (locError && !pickup) pinUpdate({ lat: 41.0694, lng: 71.8237 }, 'pickup');
  }, [locError]);

  useEffect(() => {
    if (myLocation && !pickup) {
      flyTo(myLocation);
      pinUpdate(myLocation, 'pickup');
    }
  }, [myLocation]);

  // Marshrut, masofa va narxni backend hisoblaydi (OSRM, buyurtmadagi qoida bilan bir xil); xarita chizig'ini chizadi
  const showRoute = Boolean(pickup && dropoff && !pinFor);
  const routeKey = showRoute ? `${pickup.lat},${pickup.lng}|${dropoff.lat},${dropoff.lng}` : '';
  useEffect(() => {
    if (!routeKey) { setRoute(null); return; }
    let alive = true;
    setRoute(null);
    api.post('/maps/estimate', { from_lat: pickup.lat, from_lng: pickup.lng, to_lat: dropoff.lat, to_lng: dropoff.lng })
      .then(({ data }) => { if (alive) setRoute(data); })
      .catch(() => { if (alive) setRoute({}); });
    return () => { alive = false; };
  }, [routeKey]);

  const setPoint = (type, loc, address, remember = false) => {
    if (remember) saveRecent({ ...loc, address });
    if (type === 'pickup') {
      setPickup(loc); setPickupAddress(address);
      if (!dropoff) { setStep('dropoff'); setActiveInput('dropoff'); } else { setActiveInput(null); }
    } else {
      setDropoff(loc); setDropoffAddress(address); setStep('confirm'); setActiveInput(null);
    }
    setSuggests([]);
    if (type === pinFor) setPinTitle(address);
    if (type === 'dropoff') setPinFor(null);
    flyTo(loc);
  };

  const resolveAndSet = async (loc, type) => {
    try {
      const { data } = await api.get('/maps/reverse-geocode', { params: loc });
      setPoint(type, loc, nameOf(data));
    } catch {
      setPoint(type, loc, nameOf(null));
    }
  };

  // Pin rejimida bosilgan joyga xarita suriladi (pin o'sha nuqtani oladi); aks holda borish joyi belgilanadi
  const handleMapPick = (loc) => (pinFor ? flyTo(loc, false) : resolveAndSet(loc, 'dropoff'));
  const updateAddressFromMap = (loc, type) => resolveAndSet(loc, type);

  const searchTimer = useRef(null);
  const [searching, setSearching] = useState(false);
  const handleSearch = (text, type) => {
    if (type === 'pickup') setPickupAddress(text);
    else setDropoffAddress(text);
    setActiveInput(type);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setSuggests([]); setSearching(false); return; }
    setSearching(true);
    const bias = pickup || myLocation || {};
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/maps/suggest', { text, lat: bias.lat, lng: bias.lng });
        setSuggests(data);
      } catch { setSuggests([]); }
      setSearching(false);
    }, 300);
  };

  const handleSelectSuggest = async (item, type = activeInput) => {
    if (item.lat && item.lng) {
      setPoint(type, { lat: item.lat, lng: item.lng }, item.address || item.title, true);
      return;
    }
    try {
      const params = item.uri ? { uri: item.uri } : { address: [item.title, item.subtitle].filter(Boolean).join(', ') };
      const { data } = await api.get('/maps/geocode', { params });
      if (data.length) setPoint(type, { lat: data[0].lat, lng: data[0].lng }, item.title || data[0].address, true);
    } catch {}
  };

  const clearInput = (type) => {
    if (type === 'pickup') { setPickupAddress(''); }
    else { setDropoff(null); setDropoffAddress(''); setRoute(null); }
    setSuggests([]); setActiveInput(type); setStep(type);
  };

  const pinOn = (type) => {
    setPinFor(type); setActiveInput(null); setSuggests([]);
    const p = type === 'pickup' ? pickup : (dropoff || pickup);
    if (p) { flyTo(p, type !== 'dropoff' || Boolean(dropoff)); if (type === 'dropoff' && !dropoff) pinUpdate(p, 'dropoff'); }
    setPinTitle(type === 'pickup' ? pickupAddress : dropoffAddress);
  };

  // Uy / Ish: saqlangan bo'lsa — tanlaydi; bo'lmasa joriy nuqtani shu nom bilan saqlaydi
  const PLACE_LABEL = { home: 'Uy', work: 'Ish' };
  const savePlace = async (kind, base) => {
    try {
      const { data } = await api.put(`/users/me/places/${kind}`, { address: base.address, lat: base.lat, lng: base.lng });
      setUser({ ...useUserStore.getState().user, saved_places: data });
      toast(`${PLACE_LABEL[kind]} manzili saqlandi`, base.address);
    } catch (e) { toast('Saqlanmadi', apiError(e), 'error'); }
  };
  const choosePlace = (kind) => {
    const p = places[kind];
    if (p) { handleSelectSuggest({ ...p, title: p.address }, activeInput); return; }
    const point = activeInput === 'dropoff' ? dropoff : pickup;
    const address = activeInput === 'dropoff' ? dropoffAddress : pickupAddress;
    if (!point) { toast(`${PLACE_LABEL[kind]} manzilini saqlash`, "Avval manzilni tanlang, so'ng shu tugmani bosing"); return; }
    savePlace(kind, { ...point, address });
  };

  // So'nggi manzillar: maydon bo'sh yoki hali yozilmagan bo'lsa ko'rsatiladi
  const recent = loadRecent();
  const activeText = activeInput === 'pickup' ? pickupAddress : activeInput === 'dropoff' ? dropoffAddress : '';
  const activePoint = activeInput === 'pickup' ? pickup : activeInput === 'dropoff' ? dropoff : null;
  const showRecent = Boolean(activeInput) && suggests.length === 0 && !searching && recent.length > 0
    && (activeText.trim().length < 2 || Boolean(activePoint));

  const handleMarkerDrag = useCallback(
    ({ lat, lng, type }) => updateAddressFromMap({ lat, lng }, type),
    [pickup, dropoff]
  );

  const handleOrder = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      const order = await createOrder({
        pickup: { ...pickup, address: pickupAddress },
        dropoff: { ...dropoff, address: dropoffAddress },
        paymentMethod,
      });
      navigate(`/tracking/${order.id}`);
    } catch (err) {
      toast('Buyurtma yuborilmadi', apiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const markers = [
    pickup && pinFor !== 'pickup' && { ...pickup, type: 'pickup', label: 'Chiqish joyi', draggable: true },
    dropoff && pinFor !== 'dropoff' && { ...dropoff, type: 'dropoff', label: 'Borish joyi', draggable: true },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <YandexMap
          focus={focus}
          markers={markers}
          routeLine={showRoute ? route?.polyline : null}
          onMapClick={handleMapPick}
          onMarkerDragEnd={handleMarkerDrag}
          onCenterChange={handleCenterChange}
          onMoveStart={handleMoveStart}
          style={{ height: '100%' }}
        />

        <button className="map-fab" style={{ top: 12, left: 12 }} onClick={() => navigate(-1)} aria-label="Orqaga">
          <I n="back" size={22} stroke={2.4} />
        </button>
        {pinFor && (
          <MapSearch
            bias={pickup || myLocation}
            placeholder={pinFor === 'pickup' ? 'Qayerdan? Joy nomini yozing' : 'Qayerga? Joy nomini yozing'}
            onPick={(p) => setPoint(pinFor, { lat: p.lat, lng: p.lng }, p.address, true)}
            style={{ top: 12, left: 64, right: 12 }}
          />
        )}
        {pinFor && (
          <button className="map-addr" style={{ top: 70 }} onClick={() => { setActiveInput(pinFor); setStep(pinFor); }}>
            <span className="cap">{pinFor === 'pickup' ? 'Manzilingiz' : 'Borish manzili'} <I n="next" size={12} stroke={2.6} /></span>
            <span className="t">{moving || !pinTitle ? 'Manzil aniqlanmoqda…' : pinTitle}</span>
          </button>
        )}
        {myLocation && (
          <button className="map-fab" style={{ bottom: 14, left: 12 }} onClick={locateMe} aria-label="Mening joylashuvim">
            <I n="nav" size={20} stroke={2.2} />
          </button>
        )}

        {pinFor && (
          <>
            <span className={`pin-ground${moving ? ' on' : ''}`} />
            <div className={`center-pin${moving ? ' lift' : ''}`}>
              <div className="bubble">
                <span className={`sq ${pinFor}`}><I n={pinFor === 'pickup' ? 'person' : 'flag'} size={20} stroke={2.4} /></span>
                <span className="txt">
                  <b>{pinFor === 'pickup' ? 'Shu yerdan' : 'Shu yerga'}</b>
                  <small>{pinFor === 'pickup' ? 'Chiqish joyi' : 'Borish joyi'}</small>
                </span>
              </div>
              <span className="stick" />
            </div>
          </>
        )}
      </div>

      <div style={{ background: 'var(--sheet)', padding: '14px 16px 20px', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        {/* Manzillar (Yandex Go uslubi) */}
        <div style={{ background: 'var(--fill)', borderRadius: 14, marginBottom: 10 }}>
          {[
            { type: 'pickup', value: pickupAddress, ph: 'Qayerdan?', dot: 'var(--green)', round: '50%' },
            { type: 'dropoff', value: dropoffAddress, ph: 'Qayerga?', dot: 'var(--primary)', round: 3 },
          ].map((f, idx) => (
            <div key={f.type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px 0 14px',
              borderTop: idx ? '.5px solid var(--line)' : 'none' }}>
              <span style={{ width: 10, height: 10, borderRadius: f.round, background: f.dot, flexShrink: 0 }} />
              <input
                placeholder={f.ph}
                value={f.value}
                onChange={(e) => handleSearch(e.target.value, f.type)}
                onFocus={(e) => {
                  setActiveInput(f.type); setStep(f.type); e.target.select();
                  if (f.type === 'pickup' && pinFor !== 'pickup') { setPinFor('pickup'); setPinTitle(pickupAddress); if (pickup) flyTo(pickup); }
                }}
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', padding: '13px 0',
                  fontSize: 16, fontWeight: activeInput === f.type ? 600 : 500, color: 'var(--text)' }}
              />
              {f.value && (
                <button onClick={() => clearInput(f.type)} aria-label="Tozalash"
                  style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(60,60,67,.25)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <I n="close" size={12} stroke={3} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Uy / Ish */}
        {activeInput && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['home', 'work'].map((kind) => (
              <button key={kind} className="chip" onClick={() => choosePlace(kind)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, boxShadow: '0 0 0 .5px var(--line)' }}>
                <I n={kind === 'home' ? 'home' : 'provider'} size={15} color="var(--primary)" />
                <span className="ellipsis" style={{ minWidth: 0 }}>
                  <b>{PLACE_LABEL[kind]}</b>
                  <span className="faint" style={{ fontSize: 13 }}> · {places[kind] ? places[kind].address : 'saqlash'}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Takliflar / so'nggi manzillar */}
        {activeInput && (suggests.length > 0 || showRecent || searching) && (
          <div className="group" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 10, boxShadow: '0 0 0 .5px var(--line)' }}>
            {searching && suggests.length === 0 && <div className="faint" style={{ padding: '12px 16px', fontSize: 14 }}>Qidirilmoqda…</div>}
            {(suggests.length > 0 ? suggests : (showRecent ? recent : [])).map((s, i) => {
              const isRecent = suggests.length === 0;
              return (
                <button key={i} className="group-item" onClick={() => handleSelectSuggest(isRecent ? { ...s, title: s.address } : s)}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isRecent ? 'var(--fill)' : 'var(--primary-soft)', color: isRecent ? 'var(--muted)' : 'var(--primary)' }}>
                    <I n={isRecent ? 'clock' : 'pin'} size={15} />
                  </span>
                  <div className="body">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontSize: 15, fontWeight: 500 }}>{isRecent ? s.address : s.title}</div>
                      {!isRecent && s.subtitle && <div className="faint ellipsis" style={{ fontSize: 13 }}>{s.subtitle}</div>}
                    </div>
                    {!isRecent && (s.distance || s.distance_km !== undefined) && (
                      <span className="faint" style={{ fontSize: 12, flexShrink: 0 }}>{s.distance || fmtKm(s.distance_km)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {activeInput && (
          <button className="btn ghost block" style={{ marginBottom: 10, padding: '10px 14px', fontSize: 15 }}
            onClick={() => pinOn(activeInput)}>
            <I n="map" size={16} /> Xaritadan tanlash
          </button>
        )}
        {pinFor === 'dropoff' && !activeInput && (
          <button className="btn block" style={{ marginBottom: 10 }} disabled={moving || !dropoff}
            onClick={() => { setPinFor(null); setStep('confirm'); }}>
            <I n="check" size={17} stroke={2.6} /> Shu manzilga boraman
          </button>
        )}
        {activeInput && !searching && suggests.length === 0 && !showRecent && (
          <div className="faint row" style={{ fontSize: 13, gap: 6, margin: '-2px 4px 10px' }}>
            <I n="map" size={14} /> Manzil nomini yozing yoki xaritadan bosib tanlang
          </div>
        )}

        {/* Route info */}
        {route && route.distance_km > 0 && (
          <div style={{ background: 'var(--primary-soft)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {formatDistance(route.distance_km)} · {formatDuration(route.duration_min)}
            </div>
            {route.price && <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(route.price)}</div>}
          </div>
        )}

        {/* Payment methods */}
        {route && route.distance_km > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflow: 'auto', paddingBottom: 2 }}>
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: paymentMethod === m.id ? 'var(--primary)' : 'var(--line)',
                  background: paymentMethod === m.id ? 'var(--primary-soft)' : 'var(--sheet)',
                  color: paymentMethod === m.id ? 'var(--primary)' : 'var(--muted)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                <I n={m.icon} size={14} /> {m.label}
              </button>
            ))}
          </div>
        )}

        <button
          disabled={!pickup || !dropoff || loading}
          onClick={handleOrder}
          style={{
            width: '100%', padding: 15, fontSize: 16, fontWeight: 700,
            background: pickup && dropoff ? 'var(--grad)' : 'var(--fill)',
            color: pickup && dropoff ? '#fff' : 'var(--faint)', border: 'none', borderRadius: 12,
            cursor: pickup && dropoff ? 'pointer' : 'default',
            boxShadow: pickup && dropoff ? '0 4px 16px rgba(140,28,58,0.35)' : 'none',
          }}>
          {loading ? 'Buyurtma yuborilmoqda...' : 'Taksi buyurtma qilish'}
        </button>
      </div>
    </div>
  );
}

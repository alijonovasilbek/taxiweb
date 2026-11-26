import { useState } from 'react';
import api from '../services/api';
import { useUserStore } from '../store/userStore';
import { apiError } from '../utils/formatters';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Telefon raqamini Telegram orqali tasdiqlash.
 * 1) WebApp.requestContact() imzolangan javob qaytarsa — backend imzoni tekshiradi.
 * 2) Javob bo'lmasa, kontakt bot chatiga keladi va bot uni saqlaydi — biz /users/me ni kuzatamiz.
 * Telegram'dan tashqarida (lokal dev) `canShare` false — raqam qo'lda kiritiladi.
 */
export function usePhoneShare() {
  const { fetchMe, setUser } = useUserStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tg = window.Telegram?.WebApp;
  const canShare = Boolean(tg?.initData && typeof tg.requestContact === 'function');

  const pollVerified = async () => {
    for (let i = 0; i < 8; i++) {
      await wait(1000);
      const me = await fetchMe();
      if (me?.phone_verified) return me;
    }
    return null;
  };

  const share = () => new Promise((resolve) => {
    setError(null);
    setBusy(true);
    tg.requestContact(async (shared, res) => {
      try {
        if (!shared) {
          setError('Raqam ulashilmadi. Davom etish uchun raqamingiz kerak.');
          return resolve(null);
        }
        if (res?.response) {
          const { data } = await api.post('/users/me/phone', { response: res.response });
          setUser({ ...useUserStore.getState().user, ...data });
          return resolve(data);
        }
        const me = await pollVerified();
        if (!me) setError('Raqam hali kelmadi. Bir necha soniyadan so\'ng qayta urinib ko\'ring.');
        resolve(me);
      } catch (e) {
        setError(apiError(e));
        resolve(null);
      } finally {
        setBusy(false);
      }
    });
  });

  const saveManual = async (phone) => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/users/me/phone/dev', { phone });
      setUser({ ...useUserStore.getState().user, ...data });
      return data;
    } catch (e) {
      setError(apiError(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { canShare, share, saveManual, busy, error };
}

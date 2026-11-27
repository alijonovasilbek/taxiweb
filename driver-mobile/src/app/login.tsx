import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { Field, Input } from '../components/form';
import { Button, ErrorNote, T } from '../components/ui';
import { APP_NAME, LOGIN_POLL_MS, SUPPORT } from '../config';
import { passwordLogin, pollTelegramLogin, startTelegramLogin, useAuth, type LoginTicket } from '../store/auth';
import { font, useTheme } from '../theme';

type Stage = 'idle' | 'starting' | 'waiting' | 'done' | 'password';

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const completeLogin = useAuth((s) => s.completeLogin);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef<{ t: LoginTicket; until: number } | null>(null);
  const busy = useRef(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const stop = useCallback((msg: string | null) => {
    ticket.current = null;
    setStage('idle');
    setError(msg);
  }, []);

  const poll = useCallback(async () => {
    const cur = ticket.current;
    if (!cur || busy.current) return;
    if (Date.now() > cur.until) return stop("Kutish vaqti tugadi. Qaytadan urinib ko'ring.");
    busy.current = true;
    try {
      const r = await pollTelegramLogin(cur.t.code);
      if (r !== 'pending' && ticket.current) {
        ticket.current = null;
        setStage('done');
        await completeLogin(r);
        router.replace('/');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0 && e.status !== 429) stop(e.message);
      // tarmoq xatosi — keyingi urinishda davom etamiz
    } finally {
      busy.current = false;
    }
  }, [completeLogin, router, stop]);

  useEffect(() => {
    if (stage !== 'waiting') return;
    const id = setInterval(poll, LOGIN_POLL_MS);
    // Telegram'dan qaytganda kutmasdan darhol tekshiramiz
    const sub = AppState.addEventListener('change', (st) => st === 'active' && poll());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [stage, poll]);

  const start = async () => {
    setError(null);
    setStage('starting');
    try {
      const tk = await startTelegramLogin();
      ticket.current = { t: tk, until: Date.now() + tk.expires_in * 1000 };
      setStage('waiting');
      await Linking.openURL(tk.bot_url);
    } catch (e) {
      stop(e instanceof Error ? e.message : "Telegram'ni ochib bo'lmadi");
    }
  };

  const submitPassword = async () => {
    if (!login.trim() || !password) return setError('Login va parolni kiriting');
    setError(null);
    setPwBusy(true);
    try {
      const tokens = await passwordLogin(login, password);
      setStage('done');
      await completeLogin(tokens);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kirib bo‘lmadi');
    } finally {
      setPwBusy(false);
    }
  };

  if (status === 'signedIn' && stage !== 'done') return <Redirect href="/" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.hero }} edges={['top', 'bottom']}>
      <View style={s.top}>
        <View style={s.logo}>
          <Text style={s.logoText}>C</Text>
        </View>
        <Text style={s.title}>{APP_NAME}</Text>
        <Text style={s.subtitle}>Taksi, po'puti, yuk tashish va maxsus texnika ijrochilari uchun</Text>
      </View>
      <View style={[s.sheet, { backgroundColor: t.bg }]}>
        {stage === 'password' ? (
          <View style={{ gap: 14 }}>
            <T kind="h2">Login va parol</T>
            <Field label="Login" hint="Telefon raqamingiz (998901234567) yoki botdagi login">
              <Input value={login} onChangeText={setLogin} placeholder="998901234567" plain maxLength={40} />
            </Field>
            <Field label="Parol">
              <Input value={password} onChangeText={setPassword} placeholder="••••••••" secure maxLength={100} />
            </Field>
            <ErrorNote error={error} />
            <Button title="Kirish" icon="check" loading={pwBusy} onPress={submitPassword} />
            <T kind="small" style={{ textAlign: 'center' }}>
              Parolni bilmaysizmi? Botda /parol yozing — yangi parol keladi.
            </T>
            <Button title="Orqaga" kind="ghost" onPress={() => { setError(null); setStage('idle'); }} />
          </View>
        ) : stage === 'waiting' || stage === 'done' ? (
          <View style={{ gap: 14, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={t.primary} />
            <T kind="h2" style={{ textAlign: 'center' }}>Telegram'da tasdiqlang</T>
            <T kind="muted" style={{ textAlign: 'center' }}>
              Botda «✅ Ha, kirish» tugmasini bosing va shu ilovaga qayting. Kirish avtomatik bo'ladi.
            </T>
            <Button
              title="Telegram'ni qayta ochish"
              kind="secondary"
              icon="send"
              style={{ alignSelf: 'stretch' }}
              onPress={() => ticket.current && Linking.openURL(ticket.current.t.bot_url)}
            />
            <Button title="Bekor qilish" kind="ghost" onPress={() => stop(null)} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <T kind="h2">Kirish</T>
            <T kind="muted">
              Akkauntingiz Chortoq Services Mini App'dagi bilan bir xil: transportlar, reyting va tarix saqlanadi. Birinchi
              kirishdan so'ng bot login va parol yuboradi.
            </T>
            <ErrorNote error={error} />
            <Button title="Telegram orqali kirish" icon="send" loading={stage === 'starting'} onPress={start} />
            <Button title="Login va parol bilan kirish" kind="secondary" icon="shield" onPress={() => { setError(null); setStage('password'); }} />
            <T kind="small" style={{ textAlign: 'center' }}>Yordam: {SUPPORT}</T>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontFamily: font.heavy, fontSize: 48 },
  title: { color: '#fff', fontFamily: font.heavy, fontSize: 30 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontFamily: font.medium, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32 },
});

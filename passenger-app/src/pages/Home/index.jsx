import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { useOrderStore } from '../../store/orderStore';
import { formatPrice } from '../../utils/formatters';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--tg-theme-bg-color, #f5f5f5)' },
  header: { padding: '20px 16px 12px', background: 'var(--tg-theme-bg-color, #fff)', borderBottom: '1px solid #eee' },
  greeting: { fontSize: 18, fontWeight: 600, color: 'var(--tg-theme-text-color, #000)' },
  rating: { fontSize: 13, color: '#888', marginTop: 2 },
  body: { flex: 1, padding: 16 },
  bookBtn: {
    width: '100%', padding: '16px', fontSize: 17, fontWeight: 600,
    background: 'var(--tg-theme-button-color, #2196F3)', color: 'var(--tg-theme-button-text-color, #fff)',
    border: 'none', borderRadius: 14, cursor: 'pointer',
  },
  menuGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 },
  menuCard: {
    background: '#fff', borderRadius: 14, padding: 16, cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none', textAlign: 'left',
  },
  menuTitle: { fontSize: 15, fontWeight: 600, marginTop: 8 },
  menuSub: { fontSize: 12, color: '#888', marginTop: 2 },
};

export default function Home() {
  const navigate = useNavigate();
  const { user, fetchMe } = useUserStore();
  const { activeOrder, fetchActive } = useOrderStore();

  useEffect(() => {
    const isDev = localStorage.getItem('taxigo_token') === 'dev_token';
    if (!isDev) {
      fetchMe();
      fetchActive();
    }
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.greeting}>Salom, {user?.first_name || 'Foydalanuvchi'}!</div>
        <div style={styles.rating}>⭐ {user?.rating || '5.0'} reyting · {user?.total_rides || 0} sayohat</div>
      </div>

      <div style={styles.body}>
        {activeOrder && (
          <div
            style={{ background: '#E3F2FD', borderRadius: 14, padding: 14, marginBottom: 16, cursor: 'pointer' }}
            onClick={() => navigate(`/tracking/${activeOrder.id}`)}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>Faol buyurtma mavjud</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{activeOrder.pickup_address} → {activeOrder.dropoff_address}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: '#1976D2' }}>Davom etish →</div>
          </div>
        )}

        <button style={styles.bookBtn} onClick={() => navigate('/book')}>
          🚕 Taksi buyurtma qilish
        </button>

        <div style={styles.menuGrid}>
          <button style={styles.menuCard} onClick={() => navigate('/history')}>
            <span style={{ fontSize: 28 }}>📋</span>
            <div style={styles.menuTitle}>Tarix</div>
            <div style={styles.menuSub}>Sayohatlar</div>
          </button>
          <button style={styles.menuCard} onClick={() => navigate('/profile')}>
            <span style={{ fontSize: 28 }}>👤</span>
            <div style={styles.menuTitle}>Profil</div>
            <div style={styles.menuSub}>Ma'lumotlar</div>
          </button>
        </div>
      </div>
    </div>
  );
}

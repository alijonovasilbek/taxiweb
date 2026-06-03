import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { useOrderStore } from '../../store/orderStore';

export default function Home() {
  const navigate = useNavigate();
  const { user, fetchMe } = useUserStore();
  const { activeOrder, fetchActive } = useOrderStore();

  useEffect(() => {
    if (localStorage.getItem('taxigo_token') !== 'dev_token') {
      fetchMe();
      fetchActive();
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '24px 20px 28px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 2 }}>Xush kelibsiz 👋</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{user?.first_name || 'Foydalanuvchi'}</div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            👤
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⭐</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{user?.rating || '5.0'}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🚕</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{user?.total_rides || 0} sayohat</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px', flex: 1 }}>

        {/* Active order banner */}
        {activeOrder && (
          <div
            onClick={() => navigate(`/tracking/${activeOrder.id}`)}
            style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14, padding: 14, marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚗</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1E40AF' }}>Faol buyurtma mavjud</div>
              <div style={{ fontSize: 12, color: '#3B82F6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeOrder.pickup_address} → {activeOrder.dropoff_address}
              </div>
            </div>
            <span style={{ color: '#2563EB', fontSize: 18, flexShrink: 0 }}>›</span>
          </div>
        )}

        {/* Main book button */}
        <button
          onClick={() => navigate('/book')}
          style={{ width: '100%', padding: '18px 20px', fontSize: 17, fontWeight: 700, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 16px rgba(37,99,235,0.35)', marginBottom: 20 }}
        >
          <span style={{ fontSize: 22 }}>🚕</span>
          Taksi buyurtma qilish
        </button>

        {/* Menu grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={() => navigate('/history')}
            style={{ background: '#fff', borderRadius: 16, padding: '18px 16px', cursor: 'pointer', border: 'none', textAlign: 'left', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>Tarix</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>O'tgan sayohatlar</div>
          </button>

          <button
            onClick={() => navigate('/profile')}
            style={{ background: '#fff', borderRadius: 16, padding: '18px 16px', cursor: 'pointer', border: 'none', textAlign: 'left', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>Profil</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Shaxsiy ma'lumotlar</div>
          </button>
        </div>
      </div>
    </div>
  );
}

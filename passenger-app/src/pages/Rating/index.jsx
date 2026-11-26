import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useOrderStore } from '../../store/orderStore';
import { I, ServiceIcon, CategoryIcon, CategoryGlyph } from '../../components/icons';

export default function Rating() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { clear } = useOrderStore();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await api.post('/ratings', { orderId: parseInt(orderId), rating, comment, targetRole: 'driver' });
      setSubmitted(true);
      clear();
      setTimeout(() => navigate('/'), 1500);
    } catch { alert('Xatolik yuz berdi'); }
  };

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <I n="done" size={64} color="var(--green)" />
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>Rahmat!</div>
      <div style={{ color: '#888', marginTop: 4 }}>Bahoingiz qabul qilindi</div>
    </div>
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginBottom: 12 }}><ServiceIcon code="taxi" size={64} /></div>
      <h2 style={{ marginBottom: 6 }}>Sayohat tugadi!</h2>
      <p style={{ color: '#888', marginBottom: 24 }}>Haydovchini baholang</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} onClick={() => setRating(star)}
            style={{ fontSize: 40, cursor: 'pointer', opacity: star <= rating ? 1 : 0.3 }}>
            <I n="star" size={40} color={star <= rating ? 'var(--orange)' : '#d1d1d6'} style={{ fill: star <= rating ? 'var(--orange)' : 'none' }} />
          </span>
        ))}
      </div>

      <textarea
        placeholder="Izoh qoldiring (ixtiyoriy)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 16, resize: 'none' }}
      />

      <button onClick={handleSubmit} style={{
        width: '100%', padding: 15, fontSize: 16, fontWeight: 600,
        background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
      }}>
        Baholash
      </button>

      <button onClick={() => { clear(); navigate('/'); }} style={{
        marginTop: 10, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14,
      }}>
        O'tkazib yuborish
      </button>
    </div>
  );
}

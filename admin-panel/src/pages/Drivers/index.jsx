import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_COLOR = { approved: '#4CAF50', pending: '#FF9800', blocked: '#f44336', rejected: '#9E9E9E' };
const STATUS_LABEL = { approved: 'Tasdiqlangan', pending: 'Kutilmoqda', blocked: 'Bloklangan', rejected: 'Rad etilgan' };

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const load = () => {
    const params = filter !== 'all' ? { status: filter } : {};
    api.get('/drivers', { params }).then(({ data }) => setDrivers(data.drivers || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (id) => {
    setLoading(true);
    await api.put(`/drivers/${id}/approve`).catch(() => {});
    load();
    setLoading(false);
  };

  const handleBlock = async (id) => {
    const reason = prompt('Bloklash sababi:');
    if (!reason) return;
    setLoading(true);
    await api.put(`/drivers/${id}/block`, { reason }).catch(() => {});
    load();
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Haydovchilar</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}>
          <option value="all">Barchasi</option>
          <option value="pending">Kutilmoqda</option>
          <option value="approved">Tasdiqlangan</option>
          <option value="blocked">Bloklangan</option>
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Ism', 'Telefon', 'Mashina', 'Raqam', 'Reyting', 'Holat', 'Amallar'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{d.first_name} {d.last_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{d.phone}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{d.car_model} ({d.car_color})</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{d.car_number}</td>
                <td style={{ padding: '12px 16px' }}>⭐ {d.rating}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: STATUS_COLOR[d.status] + '20', color: STATUS_COLOR[d.status], padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {d.status === 'pending' && (
                      <button onClick={() => handleApprove(d.id)} disabled={loading}
                        style={{ padding: '5px 10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Tasdiqlash
                      </button>
                    )}
                    {d.status !== 'blocked' && (
                      <button onClick={() => handleBlock(d.id)} disabled={loading}
                        style={{ padding: '5px 10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Bloklash
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Haydovchilar topilmadi</div>}
      </div>
    </div>
  );
}

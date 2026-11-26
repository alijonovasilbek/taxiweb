import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Page, Spinner, Empty } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { timeAgo } from '../../utils/formatters';

const linkFor = (n) => {
  const d = n.data || {};
  if (d.request_id) return `/requests/${d.request_id}`;
  if (d.trip_id) return `/carpool/trips/${d.trip_id}`;
  if (d.vehicle_id) return '/vehicles';
  return null;
};

export default function Notifications() {
  const navigate = useNavigate();
  const { setUnread } = useAppStore();
  const [items, setItems] = useState(null);

  const load = () => api.get('/notifications').then(({ data }) => { setItems(data.items); setUnread(data.unread); }).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    window.addEventListener('cs:notification', load);
    return () => window.removeEventListener('cs:notification', load);
  }, []);

  const open = async (n) => {
    if (!n.is_read) {
      api.put(`/notifications/${n.id}/read`).catch(() => {});
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread(Math.max(0, (items?.filter((x) => !x.is_read).length || 1) - 1));
    }
    const link = linkFor(n);
    if (link) navigate(link);
  };

  const readAll = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setUnread(0);
    load();
  };

  return (
    <Page title="Bildirishnomalar" right={items?.some((n) => !n.is_read) && <button className="btn sm accent" onClick={readAll}>Hammasini o'qish</button>}>
      {!items && <Spinner />}
      {items?.length === 0 && <Empty icon="bell" title="Bildirishnomalar yo'q" />}
      {items?.map((n) => (
        <div key={n.id} className="card clickable" onClick={() => open(n)} style={{ borderLeft: n.is_read ? 'none' : '4px solid var(--primary)' }}>
          <div className="between">
            <div className="bold">{n.title}</div>
            <span className="faint">{timeAgo(n.created_at)}</span>
          </div>
          <div className="muted mt8" style={{ whiteSpace: 'pre-line' }}>{n.message}</div>
        </div>
      ))}
    </Page>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Badge, fmtMoney, fmtDate } from '../../components/ui';

const STATUS = {
  completed: ['Bajarildi', 'green'], pending: ['Kutilmoqda', 'orange'], failed: ['Xato', 'red'], processing: ['Jarayonda', 'blue'],
};

export default function Payments() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get('/payments').then(({ data }) => setPayments(data)).catch(() => {});
  }, []);

  return (
    <div>
      <Header title="To'lovlar" sub="Taksi buyurtmalari bo'yicha to'lovlar" />
      <Table
        rows={payments}
        empty="To'lovlar topilmadi"
        columns={[
          { title: 'Buyurtma', render: (p) => <b>#{p.order_id}</b> },
          { title: 'Miqdor', render: (p) => <b style={{ color: 'var(--primary)' }}>{fmtMoney(p.amount)}</b> },
          { title: 'Usul', render: (p) => <Badge color="gray">{String(p.method || '').toUpperCase()}</Badge> },
          { title: 'Holat', render: (p) => { const [l, c] = STATUS[p.status] || [p.status, 'gray']; return <Badge color={c}>{l}</Badge>; } },
          { title: 'Tashqi ID', render: (p) => <span className="faint" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{p.external_id?.slice(0, 16) || '—'}</span> },
          { title: 'Sana', render: (p) => <span className="muted">{fmtDate(p.created_at)}</span> },
        ]}
      />
    </div>
  );
}

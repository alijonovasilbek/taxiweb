import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, fmtMoney } from '../../components/ui';

const fmtDay = (v) => new Date(v).toLocaleDateString('uz-UZ');

export default function Reports() {
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    api.get('/reports/daily').then(({ data }) => setDaily(data)).catch(() => {});
    api.get('/reports/weekly').then(({ data }) => setWeekly(data)).catch(() => {});
  }, []);

  const revenue = (v) => <b style={{ color: 'var(--primary)' }}>{fmtMoney(v)}</b>;
  const done = (v) => <span style={{ color: 'var(--green-ink)', fontWeight: 600 }}>{v}</span>;

  return (
    <div>
      <Header title="Hisobotlar" sub="Taksi buyurtmalari va daromad" />

      <h3 className="card-title" style={{ marginTop: 4 }}>Oxirgi 7 kun</h3>
      <Table
        rows={daily}
        columns={[
          { title: 'Sana', render: (d) => fmtDay(d.date) },
          { title: 'Jami', render: (d) => <b>{d.total_orders}</b> },
          { title: 'Tugadi', render: (d) => done(d.completed) },
          { title: 'Bekor', render: (d) => <span style={{ color: 'var(--red-ink)' }}>{d.cancelled}</span> },
          { title: 'Daromad', render: (d) => revenue(d.revenue) },
        ]}
      />

      <h3 className="card-title" style={{ marginTop: 28 }}>Haftalik hisobot</h3>
      <Table
        rows={weekly}
        columns={[
          { title: 'Hafta', render: (w) => fmtDay(w.week) },
          { title: 'Jami buyurtma', render: (w) => <b>{w.total_orders}</b> },
          { title: 'Tugadi', render: (w) => done(w.completed) },
          { title: 'Daromad', render: (w) => revenue(w.revenue) },
        ]}
      />
    </div>
  );
}

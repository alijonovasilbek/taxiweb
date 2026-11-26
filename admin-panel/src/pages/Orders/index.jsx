import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Pager, Badge, fmtMoney, fmtDate } from '../../components/ui';

const STATUS = {
  completed: ['Tugadi', 'green'], cancelled: ['Bekor', 'red'], searching: ['Qidirilmoqda', 'orange'],
  accepted: ['Qabul qilindi', 'blue'], in_progress: ['Sayohat', 'blue'], driver_arrived: ['Keldi', 'teal'],
  no_drivers: ['Haydovchi yo\'q', 'gray'],
};
const ellipsis = { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/orders', { params: { page, limit: 20 } }).then(({ data }) => {
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    }).catch(() => {});
  }, [page]);

  return (
    <div>
      <Header title="Buyurtmalar" sub={`Taksi buyurtmalari · jami ${total}`} />
      <Table
        rows={orders}
        empty="Buyurtmalar topilmadi"
        columns={[
          { title: '#', render: (o) => <span className="faint">#{o.id}</span> },
          { title: 'Chiqish', render: (o) => <div style={ellipsis}>{o.pickup_address}</div> },
          { title: 'Borish', render: (o) => <div style={ellipsis}>{o.dropoff_address}</div> },
          { title: 'Narx', render: (o) => <b>{fmtMoney(o.final_price || o.estimated_price)}</b> },
          { title: 'To\'lov', render: (o) => <span style={{ textTransform: 'capitalize' }}>{o.payment_method}</span> },
          { title: 'Holat', render: (o) => { const [l, c] = STATUS[o.status] || [o.status, 'gray']; return <Badge color={c}>{l}</Badge>; } },
          { title: 'Sana', render: (o) => <span className="muted">{fmtDate(o.created_at)}</span> },
        ]}
      />
      <Pager page={page} total={total} limit={20} onChange={setPage} />
    </div>
  );
}

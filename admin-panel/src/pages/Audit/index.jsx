import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Header, Table, Pager, Badge, fmtDate } from '../../components/ui';

const METHOD_COLOR = { POST: 'green', PUT: 'blue', PATCH: 'blue', DELETE: 'red' };

/** Admin harakatlari jurnali: kim, qachon, qaysi amalni bajardi. */
export default function Audit() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/audit', { params: { page, limit: 50 } }).then(({ data: d }) => setData(d)).catch(() => {});
  }, [page]);

  return (
    <div>
      <Header title="Jurnal" sub="Admin panelda bajarilgan barcha o'zgartirishlar" />
      <Table rows={data.items} empty="Hali yozuv yo'q" columns={[
        { title: 'Vaqt', render: (r) => <span className="muted">{fmtDate(r.created_at)}</span> },
        { title: 'Admin', render: (r) => <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.telegram_id}</span> },
        { title: 'Amal', render: (r) => <Badge color={METHOD_COLOR[r.method] || 'gray'}>{r.method}</Badge> },
        { title: "Yo'l", render: (r) => <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{r.path}</span> },
        { title: 'Natija', render: (r) => <Badge color={r.status < 400 ? 'green' : 'red'}>{r.status}</Badge> },
        { title: 'IP', render: (r) => <span className="faint">{r.ip}</span> },
      ]} />
      <Pager page={page} total={data.total} limit={50} onChange={setPage} />
    </div>
  );
}

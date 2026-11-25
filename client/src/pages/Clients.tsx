import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { selectDb, useAction, useAppSelector } from '../store';
import { remove } from '../store/dataSlice';
import type { Client } from '../domain/types';
import { formatDate } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { STAGE_TONE } from '../domain/display';
import { DataTable, exportCsv, type Column } from '../components/DataTable';
import { Avatar, SearchBox, useConfirm } from '../components/ui';
import { HBarList } from '../components/charts';
import { ClientForm } from './forms';

export default function Clients() {
  const db = useAppSelector(selectDb);
  const run = useAction();
  const [confirm, dialog] = useConfirm();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const rows = db.clients.filter(c => !q.trim() || `${c.firstName} ${c.lastName} ${c.city} ${c.phone}`.includes(q.trim()));
  const projectsOf = (id: number) => db.projects.filter(p => p.clientId === id);
  const revenue = (id: number) => db.payments.filter(x => x.paidDate && projectsOf(id).some(p => p.id === x.projectId)).reduce((s, x) => s + x.amount, 0);

  // which lead source actually turns into signed revenue?
  const bySource = Object.entries(db.clients.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.source]: (acc[c.source] ?? 0) + projectsOf(c.id).filter(p => ['נחתם', 'תכנון', 'ביצוע', 'הושלם'].includes(p.stage)).reduce((s, p) => s + p.fee, 0) }), {}))
    .map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const columns: Column<Client>[] = [
    { key: 'name', header: 'לקוח', sort: c => c.lastName, render: c => <div className="person"><Avatar name={`${c.firstName} ${c.lastName}`} id={c.id} /><div><b>{c.firstName} {c.lastName}</b><small>{c.city}</small></div></div> },
    { key: 'contact', header: 'טלפון', render: c => <span className="ltr num">{c.phone}</span> },
    { key: 'source', header: 'מקור', sort: c => c.source, render: c => <span className="badge">{c.source}</span> },
    { key: 'projects', header: 'פרויקטים', render: c => <div className="row wrap" style={{ gap: 6 }}>{projectsOf(c.id).map(p => <Link key={p.id} to={`/studio/projects/${p.id}`} className={`badge ${STAGE_TONE[p.stage]}`} onClick={e => e.stopPropagation()}>{p.stage}</Link>)}</div> },
    { key: 'revenue', header: 'שולם עד היום', sort: c => revenue(c.id), render: c => <b className="num">{shekel(revenue(c.id))}</b> },
    { key: 'since', header: 'לקוח מאז', sort: c => c.createdAt, render: c => <span className="muted num">{formatDate(c.createdAt)}</span> },
    { key: 'actions', header: '', render: c => <div className="row" onClick={e => e.stopPropagation()}>
      <button className="btn btn-ghost icon-btn" aria-label="עריכה" onClick={() => setEditing(c)}><Pencil size={15} /></button>
      <button className="btn btn-ghost icon-btn btn-danger" aria-label="מחיקה" onClick={async () => { if (await confirm(`למחוק את ${c.firstName} ${c.lastName}?`)) await run(remove('clients', c.id), 'הלקוח נמחק'); }}><Trash2 size={15} /></button>
    </div> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>לקוחות</h1><p>{db.clients.length} לקוחות · כולל ניתוח מקורות פנייה לפי הכנסה בפועל</p></div>
        <div className="row">
          <button className="btn" onClick={() => exportCsv('clients.csv', ['שם', 'טלפון', 'מייל', 'עיר', 'מקור'], rows.map(c => [`${c.firstName} ${c.lastName}`, c.phone, c.email, c.city, c.source]))}><Download size={17} />ייצוא</button>
          <button className="btn btn-gold" onClick={() => setEditing('new')}><Plus size={17} />לקוח חדש</button>
        </div>
      </div>
      <div className="grid cols-3">
        <div className="card span-2">
          <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="חיפוש לפי שם, עיר או טלפון" /></div>
          <DataTable rows={rows} columns={columns} initialSort={{ key: 'since', dir: -1 }} pageSize={10} />
        </div>
        <div className="card">
          <div className="card-title"><h3>שווי עסקאות חתומות לפי מקור</h3></div>
          <HBarList data={bySource} format={shekel} unit="" />
          <p className="faint" style={{ fontSize: 12 }}>מראה מאיזה ערוץ הגיעו הלקוחות שבאמת חתמו. זה הנתון הרלוונטי להחלטה איפה להשקיע בשיווק.</p>
        </div>
      </div>
      {editing && <ClientForm client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {dialog}
    </div>
  );
}

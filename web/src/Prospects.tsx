import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Users, XCircle } from 'lucide-react';
import { api, friendly } from './api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  MonthPicker,
  PageHeading,
  Pagination,
  Select,
  TextArea,
  useResource,
} from './components';
import { activeConsultants, currentMonth, dateLabel } from './utils';
import type { Prospect, User } from './types';

export function Prospects({
  user,
  users,
  version,
  changed,
}: {
  user: User;
  users: User[];
  version: number;
  changed: () => void;
}) {
  const consultants = activeConsultants(users, user);
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState('running');
  const [consultantId, setConsultantId] = useState('');
  const [page, setPage] = useState(1);
  const [add, setAdd] = useState(false);
  const result = useResource(
    `prospects:${month}:${status}:${consultantId}:${page}:${version}`,
    () => api.prospects({ month, status, consultantId: consultantId || undefined, page }),
    true,
  );
  return (
    <>
      <PageHeading
        title="Prospek pelanggan"
        detail="Catat kebutuhan pelanggan dan setiap langkah tindak lanjut."
      >
        <button className="primary" disabled={!consultants.length} onClick={() => setAdd(true)}>
          <Plus size={18} /> Tambah prospek
        </button>
      </PageHeading>
      <div className="toolbar panel">
        <div className="tabs" aria-label="Filter prospek">
          {[
            { value: 'running', label: 'Prospek berjalan' },
            { value: 'completed', label: 'Prospek selesai' },
          ].map((s) => (
            <button
              key={s.value}
              aria-pressed={status === s.value}
              className={status === s.value ? 'selected' : ''}
              onClick={() => {
                setStatus(s.value);
                setPage(1);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <MonthPicker
          month={month}
          onChange={(m) => {
            setMonth(m);
            setPage(1);
          }}
        />
      </div>
      <div className="list-subheading">
        <span className="muted">
          {result.data?.total ?? '…'} prospek · Bulan berdasarkan tanggal dibuat.
        </span>
        {user.role !== 'consultant' && (
          <Select
            label="Filter sales"
            value={consultantId}
            onChange={(v) => {
              setConsultantId(v);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Semua sales' },
              ...users
                .filter((u) => u.role === 'consultant')
                .map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
        )}
      </div>
      {result.loading && <Loading />}
      <ErrorBox error={result.error} retry={result.reload} />
      {result.data && (
        <>
          {result.data.items.length ? (
            <div className="prospect-grid">
              {result.data.items.map((item) => (
                <ProspectCard
                  key={item.id}
                  item={item}
                  salesName={
                    users.find((u) => u.id === item.consultantId)?.displayName ??
                    (item.consultantId === user.id ? user.displayName : 'Sales')
                  }
                  changed={changed}
                />
              ))}
            </div>
          ) : (
            <Empty
              title={
                status === 'running' ? 'Belum ada prospek berjalan' : 'Belum ada prospek selesai'
              }
              detail="Coba pilih bulan atau sales yang berbeda."
            />
          )}
          <Pagination page={page} total={result.data.total} setPage={setPage} />
        </>
      )}
      {add && (
        <AddProspect
          consultants={consultants}
          initialConsultantId={consultantId}
          close={() => setAdd(false)}
          saved={() => {
            setAdd(false);
            setMonth(currentMonth());
            setStatus('running');
            setConsultantId('');
            setPage(1);
            changed();
          }}
        />
      )}
    </>
  );
}

function ProspectCard({
  item,
  salesName,
  changed,
}: {
  item: Prospect;
  salesName: string;
  changed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [want, setWant] = useState(item.want);
  const [stage, setStage] = useState(item.stage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState<'berhasil' | 'gagal' | null>(null);
  const history = useResource(`history:${item.id}:${open}:${item.want}:${item.stage}`, () =>
    open ? api.prospect(item.id) : Promise.resolve(null),
  );
  useEffect(() => {
    setWant(item.want);
    setStage(item.stage);
  }, [item.want, item.stage]);
  async function update(values: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.updateProspect(item.id, values);
      setComplete(null);
      changed();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`panel prospect-card prospect-${item.status}`}>
      <button className="card-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="section-heading">
          <span className="muted">
            <Users size={17} /> {salesName}
          </span>
          <span
            className={`badge ${item.status === 'pending' ? 'pending' : item.status === 'berhasil' ? 'closed' : 'failed'}`}
          >
            {item.status === 'pending'
              ? 'Berjalan'
              : item.status === 'berhasil'
                ? 'Berhasil · Arsip'
                : 'Gagal · Arsip'}
          </span>
        </div>
        <h2>{item.name}</h2>
        <p>{item.want}</p>
        <div className="summary-bottom">
          <span>Tahap: {item.stage}</span>
          <span>{open ? 'Tutup detail ↑' : 'Tindak lanjut ↓'}</span>
        </div>
      </button>
      {open && (
        <div className="prospect-detail">
          <h3>Riwayat tindak lanjut</h3>
          {history.loading && <Loading />}
          <ErrorBox error={history.error} retry={history.reload} />
          <ol className="timeline">
            {history.data?.history.map((h) => (
              <li key={h.id}>
                <time>{dateLabel(h.createdAt)}</time>
                <strong>{h.stage}</strong>
                <p>{h.want}</p>
              </li>
            ))}
          </ol>
          {item.status === 'pending' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update({ want: want.trim(), stage: stage.trim() });
              }}
            >
              <fieldset disabled={busy}>
                <TextArea label="Mau apa berikutnya" value={want} onChange={setWant} required />
                <Field
                  label="Tahap berikutnya"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  required
                  maxLength={200}
                />
                <ErrorBox error={error} />
                <button className="primary" type="submit" disabled={!want.trim() || !stage.trim()}>
                  {busy ? 'Menyimpan…' : 'Simpan tindak lanjut'}
                </button>
                <div className="completion-actions">
                  <button
                    type="button"
                    className="text-button success"
                    onClick={() => setComplete('berhasil')}
                  >
                    <CheckCircle2 size={17} /> Berhasil
                  </button>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => setComplete('gagal')}
                  >
                    <XCircle size={17} /> Gagal
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <p className="notice">Prospek selesai. Riwayat tindak lanjut tersedia untuk dibaca.</p>
          )}
        </div>
      )}
      {complete && (
        <Modal
          title={`Tandai ${item.name} ${complete}?`}
          close={() => setComplete(null)}
          busy={busy}
        >
          <p>Prospek akan dipindahkan ke Prospek selesai dan riwayatnya menjadi arsip.</p>
          <ErrorBox error={error} />
          <div className="modal-actions">
            <button className="secondary" disabled={busy} onClick={() => setComplete(null)}>
              Batal
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => update({ status: complete })}
            >
              {busy ? 'Menyimpan…' : 'Selesaikan prospek'}
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

function AddProspect({
  consultants,
  initialConsultantId,
  close,
  saved,
}: {
  consultants: User[];
  initialConsultantId: string;
  close: () => void;
  saved: () => void;
}) {
  const [consultantId, setConsultantId] = useState(
    consultants.some((u) => u.id === initialConsultantId)
      ? initialConsultantId
      : (consultants[0]?.id ?? ''),
  );
  const [name, setName] = useState('');
  const [want, setWant] = useState('');
  const [stage, setStage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.createProspect({
        consultantId,
        name: name.trim(),
        want: want.trim(),
        stage: stage.trim(),
      });
      saved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Tambah prospek" close={close} busy={busy}>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <Select
            label="Sales"
            value={consultantId}
            onChange={setConsultantId}
            options={consultants.map((c) => ({ value: c.id, label: c.displayName }))}
            required
          />
          <Field
            label="Nama pelanggan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            autoFocus
          />
          <TextArea label="Mau apa" value={want} onChange={setWant} required />
          <Field
            label="Tahap"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            required
            maxLength={200}
          />
          <ErrorBox error={error} />
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={close}>
              Batal
            </button>
            <button
              className="primary"
              type="submit"
              disabled={!name.trim() || !want.trim() || !stage.trim() || !consultantId}
            >
              {busy ? 'Menyimpan…' : 'Simpan prospek'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

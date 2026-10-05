import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, friendly } from './api';
import {
  Check,
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
import { activeConsultants, carColors, currentMonth, dateLabel, money, today } from './utils';
import type { Spk, User } from './types';

export function SpkList({
  user,
  outstanding,
  version,
  changed,
}: {
  user: User;
  outstanding: boolean;
  version: number;
  changed: () => void;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const result = useResource(
    `spks:${outstanding}:${month}:${status}:${page}:${version}`,
    () => api.spks(outstanding ? { outstanding: 'true', page } : { month, status, page }),
    true,
  );
  return (
    <>
      <PageHeading
        title={outstanding ? 'Outstanding' : 'Surat pesanan kendaraan'}
        detail={
          outstanding
            ? 'Seluruh SPK open, termasuk dari bulan sebelumnya.'
            : 'Kelola pesanan pelanggan dan pantau progres pengiriman.'
        }
      >
        <a href="#spks/new" className="primary">
          <Plus size={18} /> Buat SPK
        </a>
      </PageHeading>
      <div className="toolbar panel">
        <div className="actions">
          {!outstanding && (
            <div className="tabs" aria-label="Filter status SPK">
              {['all', 'open', 'closed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  aria-pressed={status === s}
                  className={status === s ? 'selected' : ''}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  {s === 'all' ? 'Semua' : s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
          <span className="count">{result.data ? `${result.data.total} SPK` : 'SPK'}</span>
        </div>
        {!outstanding && (
          <MonthPicker
            month={month}
            onChange={(m) => {
              setMonth(m);
              setPage(1);
            }}
          />
        )}
      </div>
      {result.loading && <Loading />}
      <ErrorBox error={result.error} retry={result.reload} />
      {result.data && (
        <>
          {result.data.items.length ? (
            <div className="spk-grid">
              {result.data.items.map((spk) => (
                <SpkCard key={spk.id} initial={spk} user={user} changed={changed} />
              ))}
            </div>
          ) : (
            <Empty
              title="Belum ada SPK"
              detail="SPK yang sesuai dengan filter akan ditampilkan di sini."
            />
          )}
          <Pagination page={page} total={result.data.total} setPage={setPage} />
        </>
      )}
    </>
  );
}

function SpkCard({ initial, user, changed }: { initial: Spk; user: User; changed: () => void }) {
  const [spk, setSpk] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'delete' | 'cancel' | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setSpk(initial);
  }, [initial]);
  const privileged = user.role !== 'consultant';
  async function update(changes: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setSpk((current) => ({ ...current, ...changes }));
    try {
      setSpk(await api.updateSpk(spk, changes));
      setConfirm(null);
      changed();
    } catch (e) {
      setSpk(spk);
      setError(friendly(e));
      if (e instanceof ApiError && e.status === 409) {
        try {
          setSpk(await api.spk(spk.id));
          setError(
            'SPK berubah oleh pengguna lain. Data terbaru sudah dimuat. Periksa sebelum mencoba lagi.',
          );
        } catch (loadError) {
          setError(friendly(loadError));
        }
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteSpk(spk.id);
      setConfirm(null);
      changed();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`spk-card panel status-${spk.status}`}>
      <button className="card-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="section-heading">
          <span className="spk-number">
            <ClipboardList size={16} />
            {spk.number}
          </span>
          <span className={`badge ${spk.status}`}>{spk.status}</span>
        </div>
        <h2>{spk.customerName}</h2>
        <p>{spk.carType}</p>
        <small>
          {spk.color} · {dateLabel(spk.date)}
        </small>
        <div className="summary-bottom">
          <span>{spk.consultantName ?? user.displayName}</span>
          <span>{open ? 'Tutup detail ↑' : 'Lihat detail ↓'}</span>
        </div>
      </button>
      {open && (
        <div className="spk-detail">
          <dl className="detail-grid">
            <div>
              <dt>Supervisor</dt>
              <dd>{spk.supervisorName ?? 'Tanpa supervisor'}</dd>
            </div>
            <div>
              <dt>Sales</dt>
              <dd>{spk.consultantName ?? user.displayName}</dd>
            </div>
            <div>
              <dt>Telepon</dt>
              <dd>{spk.phone}</dd>
            </div>
            <div>
              <dt>Jenis klien / jumlah</dt>
              <dd>
                {spk.clientType} · {spk.quantity} unit
              </dd>
            </div>
            <div className="wide">
              <dt>Noka</dt>
              <dd className="actions">
                {spk.vin ?? 'Belum dialokasikan'}
                {spk.vin && (
                  <button
                    className="icon-button"
                    aria-label="Salin Noka"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(spk.vin!);
                        setCopied(true);
                      } catch {
                        setError('Noka belum dapat disalin. Pilih teks untuk menyalinnya.');
                      }
                    }}
                  >
                    <Copy size={15} />
                  </button>
                )}
                {copied && <small role="status">Tersalin</small>}
              </dd>
            </div>
            {spk.vin && (
              <div className="wide">
                <dt>Alokasi Noka</dt>
                <dd>{dateLabel(spk.vinAllocated)}</dd>
              </div>
            )}
            <div className="wide">
              <dt>Promise Delivery</dt>
              <dd>
                {dateLabel(spk.promiseFrom)} — {dateLabel(spk.promiseTo)}
              </dd>
            </div>
            <div>
              <dt>Pembayaran</dt>
              <dd>{spk.payment.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Harga deal</dt>
              <dd>{spk.sameAsOtr ? 'Sesuai OTR' : money(spk.dealPrice)}</dd>
            </div>
            {spk.payment === 'credit' && (
              <>
                <div>
                  <dt>Tenor / TDP</dt>
                  <dd>
                    {spk.tenorMonths} bulan · {money(spk.tdp)}
                  </dd>
                </div>
                <div>
                  <dt>Asuransi</dt>
                  <dd>{spk.insurance ?? 'Belum diisi'}</dd>
                </div>
              </>
            )}
            <div className="wide">
              <dt>Bonus</dt>
              <dd>{spk.bonus}</dd>
            </div>
            {spk.description && (
              <div className="wide">
                <dt>Deskripsi</dt>
                <dd>{spk.description}</dd>
              </div>
            )}
          </dl>
          <div className="checklist">
            <Check
              label="CRM"
              checked={spk.crmDone}
              disabled={busy || (spk.crmDone && spk.delivered)}
              onChange={(v) => update({ crmDone: v })}
            />
            <Check
              label="DMS"
              checked={spk.incentiveDms}
              disabled={!privileged || busy || (spk.incentiveDms && spk.delivered)}
              onChange={(v) => update({ incentiveDms: v })}
            />
            <Check
              label="Lunas"
              checked={spk.fullyPaid}
              disabled={
                !privileged || busy || (spk.fullyPaid && (spk.delivered || spk.deliveryPlanned))
              }
              onChange={(v) => update({ fullyPaid: v })}
            />
            <Check
              label="Plan DO"
              checked={spk.deliveryPlanned}
              disabled={
                !privileged || busy || (spk.deliveryPlanned ? spk.delivered : !spk.fullyPaid)
              }
              onChange={(v) => update({ deliveryPlanned: v, planDoDate: v ? today() : null })}
            />
            <Check
              label="Dikirim"
              checked={spk.delivered}
              disabled={
                !privileged ||
                busy ||
                (!spk.delivered && !(spk.fullyPaid && spk.incentiveDms && spk.crmDone))
              }
              onChange={(v) =>
                update({
                  delivered: v,
                  status: v ? 'closed' : 'open',
                  deliveredDate: v ? today() : null,
                })
              }
            />
          </div>
          {spk.deliveryPlanned &&
            (privileged ? (
              <Field
                label="Tanggal Plan DO"
                type="date"
                value={spk.planDoDate ?? ''}
                disabled={busy}
                onChange={(e) => {
                  if (e.target.value) update({ planDoDate: e.target.value });
                }}
              />
            ) : (
              <p>Plan DO: {dateLabel(spk.planDoDate)}</p>
            ))}
          {spk.delivered && <p className="muted">Dikirim: {dateLabel(spk.deliveredDate)}</p>}
          <div className="small-status">
            <span>Refund kredit: {spk.refundCredit ? 'Cair' : 'Belum'}</span>
            <span>Insentif CSI: {spk.incentiveCsi ? 'Cair' : 'Belum'}</span>
          </div>
          {privileged && !spk.fullyPaid && <small className="muted">Plan DO menunggu Lunas.</small>}
          {privileged && !spk.delivered && !(spk.fullyPaid && spk.incentiveDms && spk.crmDone) && (
            <small className="muted">Dikirim menunggu Lunas, DMS, dan CRM.</small>
          )}
          <ErrorBox error={error} />
          <div className="actions card-actions">
            <a
              href={`#spks/edit/${spk.id}`}
              className="secondary"
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              Edit SPK
            </a>
            {privileged && (
              <>
                <button
                  className="text-button"
                  disabled={busy || spk.delivered || spk.status === 'cancelled'}
                  onClick={() => setConfirm('cancel')}
                >
                  Batalkan SPK
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Hapus SPK"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirm('delete');
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {confirm && (
        <Modal
          title={`${confirm === 'delete' ? 'Hapus' : 'Batalkan'} ${spk.number}?`}
          busy={busy}
          close={() => setConfirm(null)}
        >
          <p>
            {confirm === 'delete'
              ? 'SPK ini akan dihapus dari server untuk seluruh tim.'
              : 'Status SPK akan berubah menjadi cancelled.'}
          </p>
          <ErrorBox error={error} />
          <div className="modal-actions">
            <button className="secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Kembali
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => (confirm === 'delete' ? remove() : update({ status: 'cancelled' }))}
            >
              {busy ? 'Menyimpan…' : confirm === 'delete' ? 'Hapus' : 'Batalkan SPK'}
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

export function SpkEditor({
  user,
  users,
  usersLoading,
  id,
  changed,
  version,
}: {
  user: User;
  users: User[];
  usersLoading: boolean;
  id?: string;
  changed: () => void;
  version: number;
}) {
  const resource = useResource(`spk:${id}:${version}`, () =>
    id ? api.spk(id) : Promise.resolve(null),
  );
  return (
    <>
      <a href="#spks" className="back-link">
        <ArrowLeft size={17} /> Kembali ke SPK
      </a>
      <PageHeading
        title={id ? 'Edit SPK' : 'Buat SPK'}
        detail="Lengkapi informasi pelanggan, kendaraan, dan rencana pengiriman."
      />
      {resource.loading || (user.role !== 'consultant' && usersLoading) ? (
        <Loading />
      ) : (
        <>
          <ErrorBox error={resource.error} retry={resource.reload} />
          {resource.data !== undefined && (
            <SpkForm
              key={`${id}:${resource.data?.revision}`}
              user={user}
              consultants={activeConsultants(users, user)}
              edit={resource.data}
              reload={resource.reload}
              saved={() => {
                changed();
                window.location.hash = 'spks';
              }}
            />
          )}
        </>
      )}
    </>
  );
}

function SpkForm({
  user,
  consultants,
  edit,
  reload,
  saved,
}: {
  user: User;
  consultants: User[];
  edit: Spk | null;
  reload: () => void;
  saved: () => void;
}) {
  const [values, setValues] = useState({
    consultantId: edit?.consultantId ?? consultants[0]?.id ?? '',
    number: edit?.number.replace('LOT - ', '') ?? '',
    date: edit?.date.slice(0, 10) ?? today(),
    customerName: edit?.customerName ?? '',
    phone: edit?.phone ?? '',
    clientType: edit?.clientType ?? 'retail',
    carType: edit?.carType ?? Object.keys(carColors)[0],
    color: edit?.color ?? carColors[Object.keys(carColors)[0]][0],
    quantity: String(edit?.quantity ?? 1),
    dealPrice: edit?.dealPrice ?? '',
    sameAsOtr: edit?.sameAsOtr ?? false,
    payment: edit?.payment ?? 'cash',
    tenorMonths: String(edit?.tenorMonths ?? ''),
    tdp: edit?.tdp ?? '',
    insurance: edit?.insurance ?? 'Combine',
    bonus: edit?.bonus ?? '',
    description: edit?.description ?? '',
    promiseFrom: edit?.promiseFrom.slice(0, 10) ?? today(),
    promiseTo: edit?.promiseTo.slice(0, 10) ?? today(),
    vin: edit?.vin ?? '',
    refundCredit: edit?.refundCredit ?? false,
    incentiveCsi: edit?.incentiveCsi ?? false,
  });
  const [standardBonus, setStandardBonus] = useState(!edit || edit.bonus === 'Bonus standar');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const set = (key: keyof typeof values, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  const privileged = user.role !== 'consultant';
  const cars = [...new Set([...Object.keys(carColors), values.carType])];
  const colors = [...new Set([...(carColors[values.carType] ?? []), values.color])];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || conflict) return;
    setError('');
    if (!/^\d{5}$/.test(values.number)) {
      setError('Nomor SPK harus tepat 5 angka.');
      return;
    }
    if (values.promiseTo < values.promiseFrom) {
      setError('Tanggal akhir Promise Delivery tidak boleh sebelum tanggal mulai.');
      return;
    }
    const moneyPattern = /^\d{1,16}(\.\d{1,2})?$/;
    if (!values.sameAsOtr && !moneyPattern.test(values.dealPrice)) {
      setError('Harga deal harus berupa angka, maksimal 16 digit dan 2 desimal.');
      return;
    }
    if (values.payment === 'credit' && !moneyPattern.test(values.tdp)) {
      setError('TDP harus berupa angka, maksimal 16 digit dan 2 desimal.');
      return;
    }
    const payload: Record<string, unknown> = {
      number: `LOT - ${values.number}`,
      date: values.date,
      customerName: values.customerName.trim(),
      phone: values.phone.trim(),
      clientType: values.clientType,
      carType: values.carType,
      color: values.color,
      quantity: Number(values.quantity),
      sameAsOtr: values.sameAsOtr,
      dealPrice: values.sameAsOtr ? null : values.dealPrice,
      payment: values.payment,
      tenorMonths: values.payment === 'credit' ? Number(values.tenorMonths) : null,
      tdp: values.payment === 'credit' ? values.tdp : null,
      insurance: values.payment === 'credit' ? values.insurance : null,
      bonus: standardBonus ? 'Bonus standar' : values.bonus.trim(),
      description: values.description.trim() || null,
      promiseFrom: values.promiseFrom,
      promiseTo: values.promiseTo,
    };
    if (!edit) payload.consultantId = values.consultantId;
    if (privileged) payload.vin = values.vin.trim() || null;
    if (edit && privileged) {
      payload.refundCredit = values.refundCredit;
      payload.incentiveCsi = values.incentiveCsi;
    }
    setBusy(true);
    try {
      if (edit) await api.updateSpk(edit, payload);
      else await api.createSpk(payload);
      saved();
    } catch (e) {
      setError(friendly(e));
      if (edit && e instanceof ApiError && e.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="spk-form" onSubmit={save}>
      <fieldset disabled={busy}>
        <section className="panel form-section">
          <h2>
            <span>01</span> Pelanggan & pesanan
          </h2>
          <div className="form-grid">
            {!edit && privileged ? (
              <Select
                label="Sales"
                value={values.consultantId}
                onChange={(v) => set('consultantId', v)}
                options={[
                  { value: '', label: 'Pilih sales' },
                  ...consultants.map((c) => ({ value: c.id, label: c.displayName })),
                ]}
                required
              />
            ) : (
              <div className="field">
                <span>Sales</span>
                <strong>{edit?.consultantName ?? user.displayName}</strong>
              </div>
            )}
            <Field
              label="Nomor SPK (5 angka)"
              hint={`LOT - ${values.number.padEnd(5, '_')}`}
              value={values.number}
              onChange={(e) => set('number', e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              pattern="[0-9]{5}"
              required
            />
            <Field
              label="Tanggal SPK"
              type="date"
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
              required
            />
            <Field
              label="Nama pelanggan"
              value={values.customerName}
              onChange={(e) => set('customerName', e.target.value)}
              maxLength={300}
              required
            />
            <Field
              label="Nomor telepon"
              type="tel"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value.replace(/[^\d+ -]/g, ''))}
              maxLength={300}
              required
            />
            <Select
              label="Jenis klien"
              value={values.clientType}
              onChange={(v) => set('clientType', v)}
              options={[
                { value: 'retail', label: 'Retail' },
                { value: 'fleet', label: 'Fleet' },
              ]}
            />
          </div>
        </section>
        <section className="panel form-section">
          <h2>
            <span>02</span> Kendaraan & pembayaran
          </h2>
          <div className="form-grid">
            <Select
              label="Tipe mobil"
              value={values.carType}
              onChange={(car) => {
                setValues((v) => ({ ...v, carType: car, color: carColors[car]?.[0] ?? v.color }));
              }}
              options={cars.map((c) => ({ value: c, label: c }))}
            />
            <Select
              label="Warna"
              value={values.color}
              onChange={(v) => set('color', v)}
              options={colors.map((c) => ({ value: c, label: c }))}
            />
            <Field
              label="Jumlah"
              type="number"
              min={1}
              max={10000}
              value={values.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              required
            />
            {privileged ? (
              <Field
                label="Noka"
                value={values.vin}
                onChange={(e) => set('vin', e.target.value)}
                maxLength={2000}
                hint="Tanggal alokasi dicatat otomatis saat Noka berubah."
              />
            ) : (
              edit?.vin && (
                <div className="field">
                  <span>Noka</span>
                  <strong>{edit.vin}</strong>
                </div>
              )
            )}
            <div className="field">
              <span>Harga</span>
              <Check
                label="Harga sama dengan OTR"
                checked={values.sameAsOtr}
                onChange={(v) => set('sameAsOtr', v)}
              />
            </div>
            {!values.sameAsOtr && (
              <Field
                label="Harga deal (Rp)"
                value={values.dealPrice}
                onChange={(e) => set('dealPrice', e.target.value)}
                inputMode="decimal"
                hint={
                  values.dealPrice && /^\d+(\.\d{1,2})?$/.test(values.dealPrice)
                    ? money(values.dealPrice)
                    : 'Angka tanpa pemisah ribuan. Desimal menggunakan titik.'
                }
                required
              />
            )}
            <Select
              label="Metode pembayaran"
              value={values.payment}
              onChange={(v) => set('payment', v)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'credit', label: 'Credit' },
                { value: 'cop', label: 'COP' },
              ]}
            />
            {values.payment === 'credit' && (
              <>
                <Field
                  label="Tenor (bulan)"
                  type="number"
                  min={1}
                  max={600}
                  value={values.tenorMonths}
                  onChange={(e) => set('tenorMonths', e.target.value)}
                  required
                />
                <Field
                  label="TDP (Rp)"
                  value={values.tdp}
                  onChange={(e) => set('tdp', e.target.value)}
                  inputMode="decimal"
                  required
                />
                <Select
                  label="Asuransi"
                  value={values.insurance}
                  onChange={(v) => set('insurance', v)}
                  options={[
                    ...new Set([
                      'Combine',
                      'All risk full tenor',
                      'All risk perluasan full tenor',
                      values.insurance,
                    ]),
                  ].map((c) => ({ value: c, label: c }))}
                />
              </>
            )}
          </div>
        </section>
        <section className="panel form-section">
          <h2>
            <span>03</span> Bonus & rencana pengiriman
          </h2>
          <Check label="Bonus standar" checked={standardBonus} onChange={setStandardBonus} />
          {!standardBonus && (
            <Field
              label="Bonus dari sales atau event"
              value={values.bonus}
              onChange={(e) => set('bonus', e.target.value)}
              required
              maxLength={300}
            />
          )}
          <TextArea
            label="Deskripsi"
            value={values.description}
            onChange={(v) => set('description', v)}
          />
          <div className="form-grid">
            <Field
              label="Promise Delivery mulai"
              type="date"
              value={values.promiseFrom}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  promiseFrom: e.target.value,
                  promiseTo: v.promiseTo < e.target.value ? e.target.value : v.promiseTo,
                }))
              }
              required
            />
            <Field
              label="Promise Delivery sampai"
              type="date"
              value={values.promiseTo}
              min={values.promiseFrom}
              onChange={(e) => set('promiseTo', e.target.value)}
              required
            />
          </div>
          {edit && privileged && (
            <div className="checklist">
              <Check
                label="Refund kredit cair"
                checked={values.refundCredit}
                onChange={(v) => set('refundCredit', v)}
              />
              <Check
                label="Insentif CSI cair"
                checked={values.incentiveCsi}
                onChange={(v) => set('incentiveCsi', v)}
              />
            </div>
          )}
        </section>
        <ErrorBox error={error} />
        {conflict && (
          <div className="notice">
            Muat ulang untuk mengganti isian dengan data terbaru, lalu terapkan kembali perubahanmu.{' '}
            <button type="button" className="text-button" onClick={reload}>
              Muat SPK terbaru
            </button>
          </div>
        )}
        <div className="form-actions">
          <a href="#spks" className="secondary">
            Batal
          </a>
          <button
            type="submit"
            className="primary"
            disabled={conflict || (!edit && !values.consultantId)}
          >
            {busy ? 'Menyimpan…' : edit ? 'Simpan perubahan' : 'Simpan SPK'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

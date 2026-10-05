import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Trash2, UserRound } from 'lucide-react';
import { api, friendly } from './api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeading,
  PasswordField,
  Select,
} from './components';
import { roles, validPassword } from './utils';
import type { Role, User } from './types';

export function Accounts({
  actor,
  users,
  loading,
  changed,
}: {
  actor: User;
  users: User[];
  loading: boolean;
  changed: () => void;
}) {
  const [add, setAdd] = useState(false);
  const [action, setAction] = useState<{
    user: User;
    kind: 'reset' | 'delete' | 'disable' | 'enable';
  } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(e: FormEvent) {
    e.preventDefault();
    if (!action || busy) return;
    if (action.kind === 'reset' && !validPassword(password)) {
      setError('Password harus minimal 12 karakter dan maksimal 72 byte.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (action.kind === 'delete') await api.deleteUser(action.user.id);
      else
        await api.accountAction(
          action.user.id,
          action.kind === 'reset' ? 'resetPassword' : action.kind,
          action.kind === 'reset' ? password : undefined,
        );
      setAction(null);
      setPassword('');
      changed();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const openAction = (user: User, kind: 'reset' | 'delete' | 'disable' | 'enable') => {
    setAction({ user, kind });
    setError('');
    setPassword('');
  };
  function card(user: User) {
    return (
      <div className="account-row" key={user.id}>
        <span className="avatar">
          <UserRound size={20} />
        </span>
        <div className="account-info">
          <strong>{user.displayName}</strong>
          <small>
            {user.username} · {roles[user.role]}
          </small>
          <span
            className={`badge ${user.active === false ? 'inactive' : user.mustChangePassword ? 'pending' : 'closed'}`}
          >
            {user.active === false
              ? 'Nonaktif'
              : user.mustChangePassword
                ? 'Menunggu perubahan password'
                : 'Aktif'}
          </span>
          {user.role === 'consultant' && (
            <small>
              {user.currentMonthSpks ?? 0} SPK bulan ini · {user.runningProspects ?? 0} prospek
              berjalan
            </small>
          )}
        </div>
        <div className="account-actions">
          <button
            className="secondary"
            disabled={user.id === actor.id}
            onClick={() => openAction(user, user.active === false ? 'enable' : 'disable')}
          >
            {user.active === false ? 'Aktifkan' : 'Nonaktifkan'}
          </button>
          <button className="secondary" onClick={() => openAction(user, 'reset')}>
            <KeyRound size={15} /> Reset password
          </button>
          <button
            className="icon-button danger"
            aria-label={`Hapus akun ${user.displayName}`}
            disabled={user.id === actor.id}
            onClick={() => openAction(user, 'delete')}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHeading title="Kelola akun" detail="Atur akses, supervisor, dan anggota tim sales.">
        <button className="primary" onClick={() => setAdd(true)}>
          <Plus size={18} /> Buat akun
        </button>
      </PageHeading>
      {loading && <Loading />}
      {!loading && (
        <div className="account-groups">
          {users
            .filter((u) => u.role === 'master')
            .map((u) => (
              <section className="panel" key={u.id}>
                {card(u)}
              </section>
            ))}
          {users
            .filter((u) => u.role === 'supervisor')
            .map((supervisor) => (
              <section className="panel account-group" key={supervisor.id}>
                {card(supervisor)}
                <div className="team-heading">
                  <span>SALES CONSULTANT</span>
                  <small>
                    {
                      users.filter(
                        (u) => u.supervisorId === supervisor.id && u.role === 'consultant',
                      ).length
                    }{' '}
                    anggota
                  </small>
                </div>
                {users
                  .filter((u) => u.supervisorId === supervisor.id && u.role === 'consultant')
                  .map(card)}
              </section>
            ))}
          {users.some((u) => u.role === 'consultant' && !u.supervisorId) && (
            <section className="panel">
              <h2>Sales tanpa supervisor</h2>
              {users.filter((u) => u.role === 'consultant' && !u.supervisorId).map(card)}
            </section>
          )}
          {users.length === 0 && <Empty title="Belum ada akun" />}
        </div>
      )}
      {add && (
        <AddAccount
          users={users}
          close={() => setAdd(false)}
          saved={() => {
            setAdd(false);
            changed();
          }}
        />
      )}
      {action && (
        <Modal
          title={`${action.kind === 'reset' ? 'Reset password' : action.kind === 'delete' ? 'Hapus akun' : action.kind === 'enable' ? 'Aktifkan akun' : 'Nonaktifkan akun'} ${action.user.displayName}?`}
          close={() => setAction(null)}
          busy={busy}
        >
          <form onSubmit={act}>
            <fieldset disabled={busy}>
              {action.kind === 'reset' ? (
                <>
                  <p>
                    Buat password sementara dan berikan kepada pemilik akun. Ia wajib menggantinya
                    saat masuk kembali.
                  </p>
                  <PasswordField
                    label="Password sementara"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={12}
                    required
                  />
                </>
              ) : (
                <p>
                  {action.kind === 'delete'
                    ? action.user.role === 'supervisor'
                      ? 'Sales di bawah supervisor ini akan menjadi tanpa supervisor. Akun tidak dapat masuk lagi; riwayat SPK dan prospek tetap tersimpan.'
                      : 'Akun tidak dapat masuk lagi. SPK dan prospek tetap tersimpan dengan nama sales.'
                    : action.kind === 'disable'
                      ? 'Akun tidak dapat masuk sampai diaktifkan kembali. Riwayat data tetap tersimpan.'
                      : 'Pemilik akun dapat masuk kembali.'}
                </p>
              )}
              <ErrorBox error={error} />
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => setAction(null)}>
                  Batal
                </button>
                <button
                  className={
                    action.kind === 'delete' || action.kind === 'disable'
                      ? 'danger-button'
                      : 'primary'
                  }
                  type="submit"
                >
                  {busy
                    ? 'Menyimpan…'
                    : action.kind === 'reset'
                      ? 'Reset password'
                      : action.kind === 'delete'
                        ? 'Hapus akun'
                        : action.kind === 'enable'
                          ? 'Aktifkan'
                          : 'Nonaktifkan'}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

function AddAccount({
  users,
  close,
  saved,
}: {
  users: User[];
  close: () => void;
  saved: () => void;
}) {
  const supervisors = users.filter((u) => u.role === 'supervisor' && u.active !== false);
  const [role, setRole] = useState<Role>('consultant');
  const [supervisorId, setSupervisorId] = useState(supervisors[0]?.id ?? '');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validPassword(password)) {
      setError('Password harus minimal 12 karakter dan maksimal 72 byte.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createUser({
        username: username.trim(),
        displayName: name.trim(),
        password,
        role,
        supervisorId: role === 'consultant' ? supervisorId : null,
      });
      saved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Buat akun" close={close} busy={busy}>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <Field
            label="Nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={160}
            autoFocus
          />
          <Field
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
            maxLength={80}
          />
          <Select
            label="Peran"
            value={role}
            onChange={(v) => setRole(v as Role)}
            options={[
              { value: 'consultant', label: roles.consultant },
              { value: 'supervisor', label: roles.supervisor },
            ]}
          />
          {role === 'consultant' && (
            <Select
              label="Supervisor"
              value={supervisorId}
              onChange={setSupervisorId}
              options={[
                { value: '', label: 'Pilih supervisor' },
                ...supervisors.map((s) => ({ value: s.id, label: s.displayName })),
              ]}
              required
            />
          )}
          <PasswordField
            label="Password sementara"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={12}
          />
          <p className="muted">Pemilik akun wajib mengganti password saat masuk pertama kali.</p>
          <ErrorBox error={error} />
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={close}>
              Batal
            </button>
            <button
              className="primary"
              type="submit"
              disabled={
                !name.trim() || !username.trim() || (role === 'consultant' && !supervisorId)
              }
            >
              {busy ? 'Menyimpan…' : 'Simpan akun'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

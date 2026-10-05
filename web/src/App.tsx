import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  CircleUserRound,
  ClipboardList,
  Home,
  KeyRound,
  LogOut,
  Menu,
  RefreshCw,
  Users,
  UserRoundCog,
  Clock3,
  X,
} from 'lucide-react';
import { api, ApiError, friendly, restoreSession } from './api';
import { ErrorBox, Field, Loading, PageHeading, PasswordField, useResource } from './components';
import { currentMonth, dateLabel, monthLabel, roles, validPassword } from './utils';
import type { User } from './types';
import { SpkEditor, SpkList } from './Spks';
import { Prospects } from './Prospects';
import { Accounts } from './Accounts';

const pages = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'spks', label: 'SPK', icon: ClipboardList },
  { id: 'outstanding', label: 'Outstanding', icon: Clock3 },
  { id: 'prospects', label: 'Prospek', icon: Users },
  { id: 'sales', label: 'Sales', icon: CircleUserRound },
  { id: 'accounts', label: 'Kelola akun', icon: UserRoundCog },
];
export const navigate = (path: string) => {
  window.location.hash = path;
};

function Login({ onLogin, message }: { onLogin: (user: User) => void; message: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(username, password));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <Building2 size={25} />
          <span>CRM for Team</span>
        </div>
        <div>
          <span className="eyebrow">RUANG KERJA TIM SALES</span>
          <h1>
            Setiap prospek.
            <br />
            Setiap langkah.
            <br />
            <em>Satu tim.</em>
          </h1>
          <p>Kelola perjalanan pelanggan, dari tindak lanjut pertama sampai kendaraan diterima.</p>
          <div className="story-chips">
            <span>SPK & pengiriman</span>
            <span>Prospek & tindak lanjut</span>
            <span>Kolaborasi tim</span>
          </div>
        </div>
        <small>Mahesa Jenar · CRM for Team</small>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <span className="login-mark">
            <Building2 size={25} />
          </span>
          <h2>Selamat datang kembali</h2>
          <p>Masuk dengan akun CRM yang sudah kamu gunakan.</p>
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          <fieldset disabled={busy}>
            <Field
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              maxLength={80}
              autoFocus
            />
            <PasswordField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <ErrorBox error={error} />
            <button className="primary full" type="submit">
              {busy ? 'Sedang masuk…' : 'Masuk'}
              <ArrowRight size={18} />
            </button>
          </fieldset>
          <small className="muted">
            Belum memiliki akun? Hubungi master tim untuk dibuatkan akun.
          </small>
        </form>
      </section>
    </main>
  );
}

function PasswordPage({
  required,
  onDone,
  back,
}: {
  required: boolean;
  onDone: () => void;
  back?: () => void;
}) {
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validPassword(next)) {
      setError('Password harus minimal 12 karakter dan maksimal 72 byte.');
      return;
    }
    if (next !== confirm) {
      setError('Konfirmasi password belum sama.');
      return;
    }
    if (old === next) {
      setError('Gunakan password yang berbeda dari password lama.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.password(old, next);
      onDone();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="password-page">
      <PageHeading
        title={required ? 'Buat password pribadi' : 'Ganti password'}
        detail={
          required
            ? 'Ganti password sementara sebelum menggunakan CRM.'
            : 'Setelah berhasil, masuk kembali dengan password baru.'
        }
      />
      <form className="panel narrow" onSubmit={save}>
        <fieldset disabled={busy}>
          <PasswordField
            label={required ? 'Password sementara' : 'Password saat ini'}
            value={old}
            onChange={(e) => setOld(e.target.value)}
            autoComplete="current-password"
            required
          />
          <PasswordField
            label="Password baru"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            minLength={12}
          />
          <PasswordField
            label="Konfirmasi password baru"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          <small className="muted">
            Minimal 12 karakter. Gunakan kombinasi yang mudah diingat dan sulit ditebak.
          </small>
          <ErrorBox error={error} />
          <div className="actions">
            {back && (
              <button type="button" className="secondary" onClick={back}>
                Batal
              </button>
            )}
            <button type="submit" className="primary">
              {busy ? 'Menyimpan…' : 'Simpan password'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function Dashboard({ user, version }: { user: User; version: number }) {
  const resource = useResource(`home:${user.id}:${version}`, async () => {
    const [month, outstanding, pending] = await Promise.all([
      api.spks({ month: currentMonth() }),
      api.spks({ outstanding: 'true' }),
      api.prospects({ status: 'running' }),
    ]);
    return { month, outstanding, pending };
  });
  return (
    <>
      <PageHeading
        title={`Selamat datang, ${user.displayName.split(' ')[0]}`}
        detail={`Ringkasan tim kamu · ${monthLabel(currentMonth())}`}
      >
        <a href="#spks/new" className="primary">
          <ClipboardList size={17} /> Buat SPK
        </a>
      </PageHeading>
      {resource.loading && <Loading />}
      <ErrorBox error={resource.error} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="metrics">
            {[
              {
                label: 'SPK bulan ini',
                value: resource.data.month.total,
                icon: ClipboardList,
                href: '#spks',
                detail: 'Semua status SPK',
              },
              {
                label: 'Outstanding',
                value: resource.data.outstanding.total,
                icon: Clock3,
                href: '#outstanding',
                detail: 'SPK open di semua bulan',
              },
              {
                label: 'Prospek berjalan',
                value: resource.data.pending.total,
                icon: Users,
                href: '#prospects',
                detail: 'Menunggu tindak lanjut · semua bulan',
              },
            ].map((metric) => (
              <a className="metric panel" href={metric.href} key={metric.label}>
                <div>
                  <span className="muted">{metric.label}</span>
                  <span className="metric-icon">
                    <metric.icon size={20} />
                  </span>
                </div>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </a>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>SPK terbaru bulan ini</h2>
                <a href="#spks" className="text-button">
                  Lihat semua <ArrowRight size={16} />
                </a>
              </div>
              {resource.data.month.items.length ? (
                <div className="recent-list">
                  {resource.data.month.items.slice(0, 5).map((item) => (
                    <a href={`#spks/edit/${item.id}`} key={item.id}>
                      <span className="recent-icon">
                        <ClipboardList size={19} />
                      </span>
                      <div>
                        <strong>{item.customerName}</strong>
                        <small>
                          {item.number} · {dateLabel(item.date)}
                        </small>
                      </div>
                      <span className={`badge ${item.status}`}>{item.status}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted">Belum ada SPK bulan ini. SPK baru akan tampil di sini.</p>
              )}
            </section>
            <section className="panel quick-panel">
              <span className="eyebrow">LANGKAH BERIKUTNYA</span>
              <h2>
                Jaga tindak lanjut <br />
                tetap berjalan.
              </h2>
              <p>
                Catat kebutuhan pelanggan dan perkembangan terakhir agar tim punya informasi yang
                sama.
              </p>
              <a href="#prospects" className="secondary">
                Buka prospek <ArrowRight size={16} />
              </a>
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [route, setRoute] = useState(window.location.hash.slice(1) || 'home');
  const [menu, setMenu] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    let alive = true;
    setRestoring(true);
    setRestoreError('');
    restoreSession()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch((e) => {
        if (alive && !(e instanceof ApiError && e.status === 401)) setRestoreError(friendly(e));
      })
      .finally(() => {
        if (alive) setRestoring(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    const hash = () => {
      setRoute(window.location.hash.slice(1) || 'home');
      setMenu(false);
      window.scrollTo(0, 0);
    };
    const expired = () => {
      setUser(null);
      setMessage('Sesi berakhir. Silakan masuk kembali.');
    };
    const passwordRequired = () => setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
    window.addEventListener('hashchange', hash);
    window.addEventListener('crm:unauthorized', expired);
    window.addEventListener('crm:password-required', passwordRequired);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('crm:unauthorized', expired);
      window.removeEventListener('crm:password-required', passwordRequired);
    };
  }, []);
  const users = useResource(`users:${user?.id}:${user?.mustChangePassword}:${version}`, () =>
    user && !user.mustChangePassword && user.role !== 'consultant'
      ? api.users()
      : Promise.resolve([]),
  );
  if (restoring)
    return (
      <div className="center-screen">
        <Loading />
      </div>
    );
  if (restoreError)
    return (
      <div className="center-screen">
        <div className="panel narrow">
          <h2>Sesi belum dapat dimuat</h2>
          <ErrorBox error={restoreError} retry={() => setAttempt((a) => a + 1)} />
        </div>
      </div>
    );
  if (!user)
    return (
      <Login
        message={message}
        onLogin={(u) => {
          setUser(u);
          setError('');
          setMessage('');
          navigate('home');
        }}
      />
    );
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await api.logout();
      setUser(null);
      setMessage('Kamu sudah keluar.');
      navigate('home');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoggingOut(false);
    }
  }
  const changed = () => setVersion((v) => v + 1);
  const page = route.split('/')[0];
  const allowed = pages
    .filter((p) => p.id !== 'accounts' || user.role === 'master')
    .filter((p) => p.id !== 'sales' || user.role === 'supervisor');
  const passwordDone = () => {
    setUser(null);
    setMessage('Password berhasil diganti. Silakan masuk dengan password baru.');
    navigate('home');
  };
  let content;
  if (user.mustChangePassword || page === 'password')
    content = (
      <PasswordPage
        required={user.mustChangePassword}
        onDone={passwordDone}
        back={user.mustChangePassword ? undefined : () => navigate('home')}
      />
    );
  else if (page === 'spks' && route.includes('/'))
    content = (
      <SpkEditor
        key={route}
        user={user}
        users={users.data ?? []}
        usersLoading={users.loading}
        version={version}
        id={route.startsWith('spks/edit/') ? route.slice(10) : undefined}
        changed={changed}
      />
    );
  else if (page === 'spks' || page === 'outstanding')
    content = (
      <SpkList
        key={page}
        user={user}
        version={version}
        outstanding={page === 'outstanding'}
        changed={changed}
      />
    );
  else if (page === 'prospects')
    content = (
      <Prospects user={user} users={users.data ?? []} version={version} changed={changed} />
    );
  else if (page === 'accounts' && user.role === 'master')
    content = (
      <Accounts actor={user} users={users.data ?? []} loading={users.loading} changed={changed} />
    );
  else if (page === 'sales' && user.role === 'supervisor')
    content = (
      <>
        <PageHeading
          title="Tim sales"
          detail="SPK bulan ini dan prospek berjalan untuk setiap anggota tim."
        />
        {users.loading && <Loading />}
        <div className="sales-grid">
          {users.data
            ?.filter((u) => u.role === 'consultant')
            .map((u) => (
              <article className="panel" key={u.id}>
                <span className="avatar">{u.displayName.slice(0, 2).toUpperCase()}</span>
                <h2>{u.displayName}</h2>
                <p className="muted">{u.username}</p>
                <span className={`badge ${u.active === false ? 'inactive' : 'closed'}`}>
                  {u.active === false
                    ? 'Nonaktif'
                    : u.mustChangePassword
                      ? 'Menunggu perubahan password'
                      : 'Aktif'}
                </span>
                <div className="team-numbers">
                  <div>
                    <strong>{u.currentMonthSpks ?? 0}</strong>
                    <small>SPK bulan ini</small>
                  </div>
                  <div>
                    <strong>{u.runningProspects ?? 0}</strong>
                    <small>Prospek berjalan</small>
                  </div>
                </div>
              </article>
            ))}
        </div>
        {users.data?.filter((u) => u.role === 'consultant').length === 0 && (
          <p className="muted">Belum ada sales consultant di tim ini.</p>
        )}
      </>
    );
  else content = <Dashboard user={user} version={version} />;
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Tutup navigasi"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'visible' : ''}`}>
        <a className="brand" href="#home">
          <Building2 size={25} />
          <span>
            CRM for Team<small>Workspace</small>
          </span>
        </a>
        <span className="nav-label">MENU UTAMA</span>
        <nav aria-label="Navigasi utama">
          {!user.mustChangePassword &&
            allowed.map((p) => (
              <a
                href={`#${p.id}`}
                key={p.id}
                className={page === p.id ? 'active' : ''}
                aria-current={page === p.id ? 'page' : undefined}
              >
                <p.icon size={19} />
                {p.label}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="connection-dot" /> Ruang kerja CRM tim
          <small>Data bersama Android & web</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="actions">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka navigasi"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>
              {user.mustChangePassword
                ? 'Pengaturan akun'
                : (pages.find((p) => p.id === page)?.label ?? 'Pengaturan akun')}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Muat ulang"
              title="Muat ulang"
              onClick={changed}
            >
              <RefreshCw size={18} />
            </button>
            {!user.mustChangePassword && (
              <a
                href="#password"
                className="icon-button"
                aria-label="Ganti password"
                title="Ganti password"
              >
                <KeyRound size={18} />
              </a>
            )}
            <div className="user-info">
              <span className="avatar small">{user.displayName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{user.displayName}</strong>
                <small>{roles[user.role]}</small>
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="Keluar"
              title="Keluar"
              disabled={loggingOut}
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <ErrorBox error={error} retry={() => setError('')} />
          <ErrorBox error={users.error} retry={users.reload} />
          {content}
        </main>
        <footer className="footer">
          CRM for Team <span>Waktu & tanggal mengikuti Asia/Jakarta</span>
        </footer>
      </div>
    </div>
  );
}

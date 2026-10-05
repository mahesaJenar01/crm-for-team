import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  LoaderCircle,
  X,
} from 'lucide-react';
import { friendly } from './api';
import { monthLabel, shiftMonth } from './utils';

export function useResource<T>(key: string, load: () => Promise<T>, keepData = false) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((previous) =>
      keepData ? { ...previous, error: undefined, loading: true } : { loading: true },
    );
    load()
      .then((data) => {
        if (alive) setState({ data, loading: false });
      })
      .catch((error) => {
        if (alive) setState({ error: friendly(error), loading: false });
      });
    return () => {
      alive = false;
    };
    // The caller includes every request parameter in key.
  }, [key, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
export function ErrorBox({ error, retry }: { error?: string; retry?: () => void }) {
  return error ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Coba lagi
        </button>
      )}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Memuat data…
    </div>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={props.required ? 'required-label' : undefined}>
        <span id={`${id}-label`}>{label}</span>
      </label>
      <input
        {...props}
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function PasswordField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id} className={props.required ? 'required-label' : undefined}>
        <span id={`${id}-label`}>{label}</span>
      </label>
      <div className="password-input">
        <input
          {...props}
          id={id}
          aria-labelledby={`${id}-label`}
          type={visible ? 'text' : 'password'}
        />
        <button
          type="button"
          aria-label={
            visible ? `Sembunyikan ${label.toLowerCase()}` : `Lihat ${label.toLowerCase()}`
          }
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={required ? 'required-label' : undefined}>
        <span id={`${id}-label`}>{label}</span>
      </label>
      <select
        id={id}
        aria-labelledby={`${id}-label`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function TextArea({
  label,
  value,
  onChange,
  required,
  maxLength = 2000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={required ? 'required-label' : undefined}>
        <span id={`${id}-label`}>{label}</span>
      </label>
      <textarea
        id={id}
        aria-labelledby={`${id}-label`}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
      />
    </div>
  );
}
export function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`check ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="month-picker">
      <button
        className="icon-button"
        aria-label="Bulan lalu"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <label>
        <span className="sr-only">Bulan</span>
        <input
          type="month"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
          }}
          aria-label={monthLabel(month)}
        />
      </label>
      <button
        className="icon-button"
        aria-label="Bulan berikut"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
export function Pagination({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (value: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 25));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages, setPage]);
  if (pages === 1) return null;
  return (
    <div className="pagination">
      <span>
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="actions">
        <button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
          <ArrowLeft size={16} /> Sebelumnya
        </button>
        <button className="secondary" disabled={page === pages} onClick={() => setPage(page + 1)}>
          Berikutnya <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function PageHeading({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label="Tutup dialog" onClick={close} disabled={busy}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

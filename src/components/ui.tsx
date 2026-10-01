import { useEffect, useRef, type ReactNode } from 'react';
import { X, Info, ArrowUpRight } from 'lucide-react';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'error' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}><Info size={17} /><div>{children}</div></div>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'field-error' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}{error && <small className="error-text" role="alert">{error}</small>}</label>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []);
    (ref.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? focusable()[0])?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); prior?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21}/></button></div>
      {children}
    </div>
  </div>;
}

export function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-symbol">＋</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Progress({ value, max, tone = 'green' }: { value: number; max: number; tone?: 'green' | 'amber' }) {
  return <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={Math.max(max, value)}><span style={{ width: `${max === 0 ? 100 : Math.min(100, value / max * 100)}%` }} /></div>;
}

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="source-link" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;
}

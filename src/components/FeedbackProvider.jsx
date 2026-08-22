import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect
} from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import Modal from './Modal';

/**
 * App-wide feedback provider exposing `useToast`, `useConfirm`, and `useAnnounce` hooks.
 */

const FeedbackContext = createContext(null);

function useFeedback(hookName) {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error(`${hookName} must be used inside <FeedbackProvider>`);
  }
  return ctx;
}

export const useToast = () => useFeedback('useToast').notify;
export const useConfirm = () => useFeedback('useConfirm').confirm;
export const useAnnounce = () => useFeedback('useAnnounce').announce;

const TOAST_ICONS = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info
};

let toastSeq = 0;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  // Two independent live regions: 'polite' waits for a pause in speech,
  // 'assertive' interrupts. Errors are assertive, progress is polite.
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const timersRef = useRef(new Map());
  const announceTimerRef = useRef(null);

  useEffect(() => {
    // Clear every pending timer if the provider unmounts.
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (input) => {
      const options = typeof input === 'string' ? { message: input } : input || {};
      const { message, tone = 'info', duration } = options;
      if (!message) return undefined;

      const id = ++toastSeq;
      // Errors stay visible longer — they usually carry a recovery action.
      const ttl = duration != null ? duration : tone === 'error' ? 8000 : 5000;

      setToasts((current) => [...current, { id, message, tone }]);

      if (ttl > 0) {
        const timer = setTimeout(() => dismiss(id), ttl);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const announce = useCallback((message, options = {}) => {
    if (!message) return;
    const setter = options.assertive ? setAssertiveMessage : setPoliteMessage;

    // Blank the region first. Without this, announcing the same string twice
    // in a row is not a text change, so screen readers stay silent.
    setter('');
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(() => setter(message), 60);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || 'Are you sure?',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'danger',
        resolve
      });
    });
  }, []);

  const closeConfirm = useCallback(
    (result) => {
      setConfirmState((current) => {
        if (current && current.resolve) current.resolve(result);
        return null;
      });
    },
    []
  );

  const value = useRef({ notify, confirm, announce });
  value.current = { notify, confirm, announce };

  return (
    <FeedbackContext.Provider value={value.current}>
      {children}

      {/* Screen-reader live regions. Always present in the DOM — regions added
          at the same time as their text are unreliably announced. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {assertiveMessage}
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-region">
          {toasts.map((toast) => {
            const Icon = TOAST_ICONS[toast.tone] || Info;
            return (
              <div
                key={toast.id}
                className={`toast toast-${toast.tone}`}
                /* role="alert" is an assertive live region, role="status" a
                   polite one — this is what makes toasts audible. */
                role={toast.tone === 'error' ? 'alert' : 'status'}
              >
                <span className="toast-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>{toast.message}</span>
                <button
                  type="button"
                  className="toast-dismiss"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmState && (
        <ConfirmDialog state={confirmState} onResolve={closeConfirm} />
      )}
    </FeedbackContext.Provider>
  );
}

/**
 * Destructive-action confirmation. Uses role="alertdialog" (rather than plain
 * "dialog") so screen readers treat it as urgent, and focuses Cancel first so
 * a stray Enter keypress cannot delete anything.
 */
function ConfirmDialog({ state, onResolve }) {
  const cancelRef = useRef(null);
  const isDanger = state.tone === 'danger';

  return (
    <Modal
      role="alertdialog"
      onClose={() => onResolve(false)}
      labelledBy="confirm-dialog-title"
      describedBy={state.message ? 'confirm-dialog-message' : undefined}
      initialFocusRef={cancelRef}
      zIndex={1500}
      panelClassName="glass-card animate-fade-in"
      panelStyle={{ width: '100%', maxWidth: '420px', padding: '24px' }}
    >
      <div style={{ display: 'flex', gap: '14px', marginBottom: '18px' }}>
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'var(--primary-light)',
            color: isDanger ? '#ef4444' : 'var(--primary)'
          }}
        >
          <AlertTriangle size={20} />
        </div>

        <div>
          <h2
            id="confirm-dialog-title"
            style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '6px' }}
          >
            {state.title}
          </h2>
          {state.message && (
            <p
              id="confirm-dialog-message"
              style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
            >
              {state.message}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          ref={cancelRef}
          type="button"
          className="btn-secondary"
          onClick={() => onResolve(false)}
          style={{ padding: '9px 18px', fontSize: '0.85rem' }}
        >
          {state.cancelLabel}
        </button>

        <button
          type="button"
          onClick={() => onResolve(true)}
          style={{
            padding: '9px 18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '10px',
            color: '#ffffff',
            backgroundColor: isDanger ? '#ef4444' : 'var(--primary)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {state.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

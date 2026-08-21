import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Accessible dialog shell used by every modal in the app.
 *
 * Handles the four things a hand-rolled overlay div always misses:
 *   1. Semantics    — role="dialog" + aria-modal so assistive tech announces it
 *                     as a dialog and hides the page behind it.
 *   2. Focus trap   — Tab / Shift+Tab cycle inside the panel instead of walking
 *                     into the (visually obscured) page underneath.
 *   3. Focus return — focus goes back to whatever opened the dialog on close.
 *   4. Escape       — closes the topmost dialog only, so nested dialogs work.
 *
 * The shell deliberately renders no header. Each modal keeps its own bespoke
 * header markup and just points `labelledBy` at that heading's id, so adopting
 * this wrapper never means rebuilding a modal's layout.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex^="-"])'
].join(',');

// Stack of currently-open dialogs. Escape and the scroll lock both need to
// know which dialog is on top, and how many are open in total.
const modalStack = [];
let savedBodyOverflow = null;

function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

export default function Modal({
  onClose,
  /** id of the element (usually an <h2>/<h3>) that names this dialog */
  labelledBy,
  /** used instead of labelledBy when the dialog has no visible heading */
  label,
  /** id of an element describing the dialog in more detail */
  describedBy,
  /** clicking the dimmed backdrop closes the dialog */
  closeOnBackdrop = true,
  closeOnEscape = true,
  /** focus this element on open instead of the first focusable child */
  initialFocusRef,
  zIndex = 500,
  overlayStyle,
  panelStyle,
  panelClassName = 'glass-card animate-fade-in',
  /** role="alertdialog" for destructive confirmations */
  role = 'dialog',
  children
}) {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);
  const tokenRef = useRef({});

  // --- Register in the stack, lock body scroll, move + restore focus --------
  useEffect(() => {
    const token = tokenRef.current;
    restoreFocusTo.current = document.activeElement;
    modalStack.push(token);

    if (modalStack.length === 1) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    // Wait a frame so the panel is laid out before we try to focus into it.
    const raf = requestAnimationFrame(() => {
      const explicit = initialFocusRef && initialFocusRef.current;
      const target = explicit || getFocusable(panelRef.current)[0] || panelRef.current;
      if (target) {
        try {
          target.focus({ preventScroll: true });
        } catch (e) {
          /* element vanished between frames */
        }
      }
    });

    return () => {
      cancelAnimationFrame(raf);

      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);

      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow || '';
        savedBodyOverflow = null;
      }

      const previous = restoreFocusTo.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch (e) {
          /* element unmounted */
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!closeOnEscape) return undefined;

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== tokenRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      if (onClose) onClose();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [closeOnEscape, onClose]);

  const handlePanelKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return;

    const focusable = getFocusable(panelRef.current);

    // Nothing focusable inside: hold focus on the panel itself rather than
    // letting Tab escape to the page behind the overlay.
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleOverlayMouseDown = (e) => {
    if (!closeOnBackdrop) return;
    // Only a press that both starts and ends on the backdrop closes the
    // dialog — a text selection that drags out of the panel should not.
    if (e.target !== e.currentTarget) return;
    if (onClose) onClose();
  };

  return (
    <div
      onMouseDown={handleOverlayMouseDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        ...overlayStyle
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={panelClassName}
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
}

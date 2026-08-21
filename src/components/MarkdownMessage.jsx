// src/components/MarkdownMessage.jsx
// Renders AI Markdown output with GFM support while keeping raw HTML inert for security.

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Wide tables must scroll inside their own box. Without this the table forces
 * the whole chat column wider than the viewport on a phone.
 */
function Table({ node, ...props }) {
  return (
    <div className="md-table-wrap">
      <table {...props} />
    </div>
  );
}

/**
 * Links in model output are untrusted. `noopener noreferrer` stops the opened
 * page from reaching back through window.opener.
 */
function Anchor({ node, ...props }) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}

const COMPONENTS = { table: Table, a: Anchor };
const PLUGINS = [remarkGfm];

/**
 * Renders an AI response as formatted Markdown.
 *
 * @param {string}  children - the raw Markdown returned by the model
 * @param {boolean} compact  - tighter vertical rhythm, for chat bubbles
 * @param {string}  className - extra classes for the wrapper
 */
export default function MarkdownMessage({ children, compact = false, className = '' }) {
  const text = typeof children === 'string' ? children : String(children ?? '');

  // A streaming response starts empty. Rendering nothing is correct here — the
  // caller shows its own typing indicator.
  if (!text.trim()) return null;

  return (
    <div className={`md-body${compact ? ' md-compact' : ''}${className ? ` ${className}` : ''}`}>
      <Markdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}

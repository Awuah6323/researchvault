// src/components/MarkdownMessage.jsx
// Renders AI Markdown output with GFM support while keeping raw HTML inert for security.

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function Table({ node, ...props }) {
  return (
    <div className="md-table-wrap">
      <table {...props} />
    </div>
  );
}

function isSafeHref(href) {
  if (!href || typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (trimmed === '' || trimmed === '#') return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

  if (/^https?:\/\//i.test(trimmed) || /^mailto:[^\s@]+@[^\s@]+/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const protocol = parsed.protocol.toLowerCase();
      return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
    } catch {
      return false;
    }
  }

  return false;
}

function Anchor({ node, href, ...props }) {
  const safeHref = isSafeHref(href) ? href : '#';
  const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
  return (
    <a
      {...props}
      href={safeHref}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    />
  );
}

const COMPONENTS = { table: Table, a: Anchor };
const PLUGINS = [remarkGfm];

export default function MarkdownMessage({ children, compact = false, className = '' }) {
  const text = typeof children === 'string' ? children : String(children ?? '');

  if (!text.trim()) return null;

  return (
    <div className={`md-body${compact ? ' md-compact' : ''}${className ? ` ${className}` : ''}`}>
      <Markdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}

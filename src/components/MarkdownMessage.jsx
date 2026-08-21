// src/components/MarkdownMessage.jsx
//
// The one place AI output is turned into formatted text.
//
// Every AI surface in the app used to render the model's reply as raw text
// inside a `white-space: pre-wrap` div, so the Markdown the prompts explicitly
// ask for was printed literally — `**bold**` showed its asterisks and `* point`
// showed a stray `*` instead of a bullet. That was the whole of the "I don't
// like how it presents the answers" complaint: a rendering gap, not a prompting
// one.
//
// Two deliberate choices here:
//
//   1. remark-gfm is enabled, so tables, strikethrough and task lists work. The
//      chat prompt is allowed to use a table when comparing things, and without
//      GFM those would render as raw `|` pipes.
//
//   2. rehype-raw is deliberately NOT installed. react-markdown ignores raw
//      HTML in its input by default, and that default is load-bearing: the
//      string being rendered is model output that can quote arbitrary text from
//      a user's PDF. Keeping HTML inert means a paper containing `<script>` is
//      displayed, not executed. Do not add rehype-raw to this component.
//
// Presentation lives in index.css under `.md-body` rather than inline styles,
// because there are ~15 element types to cover and the surrounding pages'
// inline-style approach does not scale to that. Only the two overrides below
// need JavaScript.

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

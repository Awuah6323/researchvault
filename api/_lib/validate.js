// api/_lib/validate.js
// Request validation for the serverless endpoints.
//
// WHY NOT A LIBRARY: the whole validated surface is two endpoints and six
// fields. Zod or Joi would be a reasonable choice for a larger API, but here it
// would add a runtime dependency and cold-start weight to functions that need
// to check "is this a string, is it short enough, is it one of three values".
// If the API grows past a dozen fields, replacing this file with a schema
// library is a contained change — every caller already goes through validate().

/** A string field: type, trimming, length, and an optional value allowlist. */
export function str({ required = true, min = 1, max = 1000, allow = null, trim = true } = {}) {
  return (value, field) => {
    if (value === undefined || value === null || value === '') {
      if (required) throw invalid(`${field} is required`);
      return undefined;
    }

    if (typeof value !== 'string') throw invalid(`${field} must be a string`);

    const out = trim ? value.trim() : value;

    if (out.length < min) throw invalid(`${field} is too short`);
    if (out.length > max) throw invalid(`${field} must be at most ${max} characters`);
    if (allow && !allow.includes(out)) throw invalid(`${field} is not a supported value`);

    return out;
  };
}

/** A boolean field. Accepts real booleans and the two JSON-ish string forms. */
export function bool({ required = false, fallback = false } = {}) {
  return (value, field) => {
    if (value === undefined || value === null) {
      if (required) throw invalid(`${field} is required`);
      return fallback;
    }
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw invalid(`${field} must be a boolean`);
  };
}

/**
 * Runs a schema over an untrusted object.
 *
 * Returns a NEW object built only from the fields the schema names. Anything
 * the caller sent that the schema does not mention is dropped rather than
 * passed along, which is what stops an unexpected key from reaching a database
 * or an upstream API body just because nothing happened to reject it.
 */
export function validate(input, schema) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Request body must be a JSON object');
  }

  const out = {};
  for (const [field, check] of Object.entries(schema)) {
    const value = check(input[field], field);
    if (value !== undefined) out[field] = value;
  }
  return out;
}

/**
 * Strips characters that have no business in text forwarded to another service.
 *
 * C0 control characters (except tab, newline, carriage return) and the Unicode
 * bidi/zero-width formatting characters. The bidi overrides are the interesting
 * ones: they can make text render in an order different from how it is stored,
 * which is a way to hide content from a human reviewing a prompt.
 */
export function stripControlChars(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}

export function invalid(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

export function isValidationError(err) {
  return err?.code === 'VALIDATION' || err?.code === 'BAD_JSON' || err?.code === 'BODY_TOO_LARGE';
}

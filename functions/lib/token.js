/**
 * Ordered list of environment variable keys that may contain the shared token
 * signing secret. The first matching key is used to keep compatibility with
 * existing deployments.
 */
const SIGNING_SECRET_KEYS = [
  "BOOTSTRAP_SIGNING_SECRET",
  "B_SIGNING_SECRET",
  "SIGNING_SECRET",
  "TOKEN_SECRET",
  "HMAC_SECRET"
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const signingKeyCache = new Map();

/**
 * Encodes a string/ArrayBuffer into a URL-safe base64 variant. Used for both
 * payload and signature encoding in tokens so they can be embedded into query
 * parameters.
 *
 * @param {ArrayBufferView|ArrayBuffer|string} input
 * @returns {string}
 */
export function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = encoder.encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (ArrayBuffer.isView(input)) {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else {
    throw new TypeError("Unsupported input type for base64 encoding");
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBytes(input = "") {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeToString(input = "") {
  const bytes = base64UrlDecodeToBytes(input);
  return decoder.decode(bytes);
}

/**
 * Attempts to read the signing secret from the environment using a small set
 * of possible variable names.
 *
 * @param {Env} env
 * @returns {string}
 */
function getSigningSecret(env) {
  for (const key of SIGNING_SECRET_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  throw new Error("Missing signing secret for token");
}

/**
 * Lazily imports and caches a subtle crypto HMAC key derived from the secret.
 *
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
async function getSigningKey(secret) {
  if (!signingKeyCache.has(secret)) {
    const keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    signingKeyCache.set(secret, keyPromise);
  }

  return signingKeyCache.get(secret);
}

/**
 * Produces a signed token for the provided payload using the shared HMAC
 * secret. The payload is JSON-stringified and the signature is computed over
 * the raw JSON string for consistent verification semantics.
 *
 * @param {Env} env
 * @param {Record<string, any>} payload
 * @returns {Promise<string>}
 */
export async function encodeToken(env, payload) {
  const json = JSON.stringify(payload);
  const payloadSegment = base64UrlEncode(json);
  const secret = getSigningSecret(env);
  const key = await getSigningKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(json));
  const signatureSegment = base64UrlEncode(signatureBuffer);
  return `${payloadSegment}.${signatureSegment}`;
}

/**
 * Verifies a previously signed token by checking the HMAC signature and
 * returning the decoded JSON payload.
 *
 * @param {Env} env
 * @param {string} token
 * @returns {Promise<Record<string, any>>}
 */
export async function verifyToken(env, token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Missing token");
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed token");
  }

  const [payloadSegment, signatureSegment] = parts;
  const payloadJson = base64UrlDecodeToString(payloadSegment);
  const signatureBytes = base64UrlDecodeToBytes(signatureSegment);

  const secret = getSigningSecret(env);
  const key = await getSigningKey(secret);
  const verified = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payloadJson)
  );

  if (!verified) {
    throw new Error("Invalid token signature");
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (err) {
    throw new Error("Invalid token payload");
  }

  return payload;
}

/**
 * Generate a HMAC-SHA-512 stretched key using PBKDF2
 * from a provided password.
 * This is intended for JWT signing.
 * See:
 *  - https://en.wikipedia.org/wiki/Key_stretching
 *  - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#PBKDF2
 * @param {string} password Secret, ideally of high entropy,
 *                          for deriving the key.
 * @param {buffer} salt Salt to spice the PBKDF2 algorithm.
 * @param {int} iterations How many encryption spins inside PBKDF2 to
 *                         add work needed for brute force attacks.
 */
async function genJWTAuthKey(password, salt, iterations) {
    return window.crypto.subtle.exportKey('raw',
      await window.crypto.subtle.deriveKey(
        {
          "name": "PBKDF2",
          salt: new Uint8Array(salt),
          "iterations": iterations,
          "hash": "SHA-512"
        },
        await window.crypto.subtle.importKey(
          "raw",
          (new TextEncoder('utf-8')).encode(password),
          "PBKDF2",
          false,
          ["deriveBits", "deriveKey"]
        ),
        {"name": "HMAC", "hash": "SHA-512"}, // use for JWT signing.
        true,
        [ "sign", "verify" ]
      )
    );
  };
  
  
  /**
   * Generate an AES-GCM-256 stretched key using PBKDF2
   * from a provided password.
   * This is intended for AES encryption.
   * See:
   *  - https://en.wikipedia.org/wiki/Key_stretching
   *  - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#PBKDF2
   * @param {string} password Secret, ideally of high entropy,
   *                          for deriving the key.
   * @param {buffer} salt Salt to spice the PBKDF2 algorithm.
   * @param {int} iterations How many encryption spins inside PBKDF2 to
   *                         add work needed for brute force attacks.
   */
  async function genAESEncKey(password, salt, iterations) {
    return window.crypto.subtle.exportKey('raw',
      await window.crypto.subtle.deriveKey(
        {
          "name": "PBKDF2",
          salt: new Uint8Array(salt),
          "iterations": iterations,
          "hash": "SHA-512"
        },
        await window.crypto.subtle.importKey(
          "raw",
          (new TextEncoder('utf-8')).encode(password),
          "PBKDF2",
          false,
          ["deriveBits", "deriveKey"]
        ),
        {"name": "AES-GCM", "length": 256}, // AES encryption.
        true,
        [ "encrypt", "decrypt" ]
      )
    );
  };

  export {genJWTAuthKey, genAESEncKey};
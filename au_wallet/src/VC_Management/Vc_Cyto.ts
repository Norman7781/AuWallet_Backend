/**
 * @sd-jwt/sd-jwt-vc expects the `signer` callback to return a raw JOSE-format
 * ECDSA signature (r || s, base64url) — not a DER signature, not a full JWT.
 * Node's crypto.sign() with ES256 produces DER by default, so this converts.
 */
export function derToJose(der: Buffer, size = 32): string {
  let offset = 2; // skip SEQUENCE tag + length byte
  function readInt(): Buffer {
    if (der[offset] !== 0x02)
      throw new Error('expected INTEGER in DER signature');
    const len = der[offset + 1];
    offset += 2;
    let bytes = der.subarray(offset, offset + len);
    offset += len;
    if (bytes[0] === 0x00) bytes = bytes.subarray(1); // strip leading zero pad
    return bytes;
  }
  const r = readInt();
  const s = readInt();
  const pad = (b: Buffer) => Buffer.concat([Buffer.alloc(size - b.length), b]);
  return Buffer.concat([pad(r), pad(s)]).toString('base64url');
}

/** Inverse of derToJose — needed if you build a verifier locally for testing. */
export function joseToDer(sigB64url: string, size = 32): Buffer {
  const sigBuf = Buffer.from(sigB64url, 'base64url');
  const r = sigBuf.subarray(0, size);
  const s = sigBuf.subarray(size, size * 2);
  const trim = (b: Buffer) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let out = b.subarray(i);
    if (out[0] & 0x80) out = Buffer.concat([Buffer.from([0x00]), out]);
    return out;
  };
  const rEnc = trim(r);
  const sEnc = trim(s);
  const seq = Buffer.concat([
    Buffer.from([0x02, rEnc.length]),
    rEnc,
    Buffer.from([0x02, sEnc.length]),
    sEnc,
  ]);
  return Buffer.concat([Buffer.from([0x30, seq.length]), seq]);
}

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

function appRoot(): string {
  if (import.meta.url.includes('/snapshot/')) return dirname(process.execPath);
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

const CERTS_DIR = join(appRoot(), 'certs');
const KEY_PATH = join(CERTS_DIR, 'server.key');
const CERT_PATH = join(CERTS_DIR, 'server.crt');

export interface Certificates {
  key: Buffer;
  cert: Buffer;
}

function encodeLength(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

function encodeSequence(content: Buffer): Buffer {
  return derTag(0x30, content);
}

function encodeOID(oid: string): Buffer {
  const parts = oid.split('.').map(Number);
  const result: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v < 0x80) {
      result.push(v);
    } else {
      const bytes: number[] = [];
      while (v > 0) { bytes.unshift(v & 0x7f); v >>= 7; }
      for (let j = 0; j < bytes.length - 1; j++) bytes[j] |= 0x80;
      result.push(...bytes);
    }
  }
  return derTag(0x06, Buffer.from(result));
}

function encodeInteger(value: bigint): Buffer {
  if (value === 0n) return derTag(0x02, Buffer.from([0x00]));
  const bytes: number[] = [];
  let r = value;
  while (r > 0n) { bytes.unshift(Number(r & 0xffn)); r >>= 8n; }
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return derTag(0x02, Buffer.from(bytes));
}

function encodeUTCTime(date: Date): Buffer {
  const yy = date.getFullYear().toString().slice(2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const mi = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return derTag(0x17, Buffer.from(`${yy}${mm}${dd}${hh}${mi}${ss}Z`));
}

function encodeName(cn: string): Buffer {
  const attr = encodeSequence(
    Buffer.concat([
      encodeOID('2.5.4.3'),
      derTag(0x0c, Buffer.from(cn)),
    ])
  );
  return encodeSequence(derTag(0x31, attr));
}

function encodeBitString(data: Buffer): Buffer {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), data]));
}

function decodePemBase64(pem: string): Buffer {
  return Buffer.from(pem.replace(/-----.*-----|\n|\r/g, ''), 'base64');
}

function generateCert(): { key: string; cert: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const spkiDer = decodePemBase64(publicKey);
  const now = new Date();
  const oneYear = new Date(now);
  oneYear.setFullYear(oneYear.getFullYear() + 1);
  const serial = BigInt(Math.floor(Math.random() * 2 ** 31));

  const sigAlgOid = encodeOID('1.2.840.113549.1.1.11');
  const sigAlg = encodeSequence(Buffer.concat([sigAlgOid, derTag(0x05, Buffer.alloc(0))]));

  const tbs = encodeSequence(
    Buffer.concat([
      encodeInteger(serial),
      sigAlg,
      encodeName('darkmic'),
      encodeSequence(Buffer.concat([encodeUTCTime(now), encodeUTCTime(oneYear)])),
      encodeName('darkmic'),
      spkiDer,
    ])
  );

  const sign = createSign('RSA-SHA256');
  sign.update(tbs);
  const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363', padding: undefined });

  const certDer = encodeSequence(
    Buffer.concat([tbs, sigAlg, encodeBitString(sig)])
  );

  const certPem = [
    '-----BEGIN CERTIFICATE-----',
    ...certDer.toString('base64').match(/.{1,64}/g)!,
    '-----END CERTIFICATE-----',
    '',
  ].join('\n');

  return { key: privateKey, cert: certPem };
}

export function loadOrCreateCertificates(): Certificates {
  if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
    return {
      key: readFileSync(KEY_PATH),
      cert: readFileSync(CERT_PATH),
    };
  }

  console.log('Generating self-signed certificates...');
  mkdirSync(CERTS_DIR, { recursive: true });

  const { key, cert } = generateCert();
  writeFileSync(KEY_PATH, key);
  writeFileSync(CERT_PATH, cert);

  console.log(`Certificates written to ${CERTS_DIR}`);
  return {
    key: readFileSync(KEY_PATH),
    cert: readFileSync(CERT_PATH),
  };
}

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const CERTS_DIR = join(process.cwd(), 'certs');
const KEY_PATH = join(CERTS_DIR, 'server.key');
const CERT_PATH = join(CERTS_DIR, 'server.crt');

export interface Certificates {
  key: Buffer;
  cert: Buffer;
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

  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -nodes -subj "/CN=darkmic.local"`,
  );

  console.log(`Certificates written to ${CERTS_DIR}`);
  return {
    key: readFileSync(KEY_PATH),
    cert: readFileSync(CERT_PATH),
  };
}

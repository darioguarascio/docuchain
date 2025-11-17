import crypto from 'crypto';

export const calculateHash = (data: string | Buffer): string =>
  crypto.createHash('sha256').update(data).digest('hex');

export const deterministicStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(deterministicStringify).join(',')}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${deterministicStringify(value[key])}`);

  return `{${entries.join(',')}}`;
};

export const calculateObjectHash = (value: any): string =>
  calculateHash(deterministicStringify(value));


const ZIP_ENTRY_NAME = "content.txt";
const ZIP_CONTENT_TYPE = "application/zip";
const ZIP_VERSION = 20;
const ZIP_METHOD_STORE = 0;
const ZIP_DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;
const ZIP_DOS_TIME = 0;

type ProjectArchive = {
  archiveBlob: Blob;
  archiveBytes: Uint8Array;
  checksum: string;
  contentLength: number;
  contentType: string;
};

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }

  crcTable = table;
  return table;
}

function computeCrc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function buildStoredZipArchive(fileName: string, contentBytes: Uint8Array): Uint8Array {
  const fileNameBytes = new TextEncoder().encode(fileName);
  const crc32 = computeCrc32(contentBytes);
  const localHeaderSize = 30 + fileNameBytes.length;
  const centralHeaderSize = 46 + fileNameBytes.length;
  const endOfCentralDirectorySize = 22;
  const totalSize =
    localHeaderSize +
    contentBytes.length +
    centralHeaderSize +
    endOfCentralDirectorySize;

  const archive = new Uint8Array(totalSize);
  const view = new DataView(archive.buffer);

  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, ZIP_VERSION);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, ZIP_METHOD_STORE);
  writeUint16(view, 10, ZIP_DOS_TIME);
  writeUint16(view, 12, ZIP_DOS_DATE);
  writeUint32(view, 14, crc32);
  writeUint32(view, 18, contentBytes.length);
  writeUint32(view, 22, contentBytes.length);
  writeUint16(view, 26, fileNameBytes.length);
  writeUint16(view, 28, 0);
  archive.set(fileNameBytes, 30);
  archive.set(contentBytes, localHeaderSize);

  const centralDirectoryOffset = localHeaderSize + contentBytes.length;
  writeUint32(view, centralDirectoryOffset, 0x02014b50);
  writeUint16(view, centralDirectoryOffset + 4, ZIP_VERSION);
  writeUint16(view, centralDirectoryOffset + 6, ZIP_VERSION);
  writeUint16(view, centralDirectoryOffset + 8, 0);
  writeUint16(view, centralDirectoryOffset + 10, ZIP_METHOD_STORE);
  writeUint16(view, centralDirectoryOffset + 12, ZIP_DOS_TIME);
  writeUint16(view, centralDirectoryOffset + 14, ZIP_DOS_DATE);
  writeUint32(view, centralDirectoryOffset + 16, crc32);
  writeUint32(view, centralDirectoryOffset + 20, contentBytes.length);
  writeUint32(view, centralDirectoryOffset + 24, contentBytes.length);
  writeUint16(view, centralDirectoryOffset + 28, fileNameBytes.length);
  writeUint16(view, centralDirectoryOffset + 30, 0);
  writeUint16(view, centralDirectoryOffset + 32, 0);
  writeUint16(view, centralDirectoryOffset + 34, 0);
  writeUint16(view, centralDirectoryOffset + 36, 0);
  writeUint32(view, centralDirectoryOffset + 38, 0);
  writeUint32(view, centralDirectoryOffset + 42, 0);
  archive.set(fileNameBytes, centralDirectoryOffset + 46);

  const centralDirectorySize = centralHeaderSize;
  const endOffset = centralDirectoryOffset + centralHeaderSize;
  writeUint32(view, endOffset, 0x06054b50);
  writeUint16(view, endOffset + 4, 0);
  writeUint16(view, endOffset + 6, 0);
  writeUint16(view, endOffset + 8, 1);
  writeUint16(view, endOffset + 10, 1);
  writeUint32(view, endOffset + 12, centralDirectorySize);
  writeUint32(view, endOffset + 16, centralDirectoryOffset);
  writeUint16(view, endOffset + 20, 0);

  return archive;
}

function readStoredZipArchive(archiveBytes: Uint8Array): Uint8Array {
  const view = new DataView(
    archiveBytes.buffer,
    archiveBytes.byteOffset,
    archiveBytes.byteLength,
  );

  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("Unexpected ZIP local file header signature.");
  }

  const compressionMethod = view.getUint16(8, true);
  if (compressionMethod !== ZIP_METHOD_STORE) {
    throw new Error("Only stored ZIP archives are supported.");
  }

  const fileNameLength = view.getUint16(26, true);
  const extraFieldLength = view.getUint16(28, true);
  const contentLength = view.getUint32(18, true);
  const fileNameOffset = 30;
  const contentOffset = fileNameOffset + fileNameLength + extraFieldLength;
  const entryName = new TextDecoder().decode(
    archiveBytes.slice(fileNameOffset, fileNameOffset + fileNameLength),
  );

  if (entryName !== ZIP_ENTRY_NAME) {
    throw new Error(`Unexpected project archive entry: "${entryName}". Expected "${ZIP_ENTRY_NAME}".`);
  }

  return archiveBytes.slice(contentOffset, contentOffset + contentLength);
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this browser.");
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildProjectArchive(content: string): Promise<ProjectArchive> {
  const contentBytes = new TextEncoder().encode(content);
  const archiveBytes = buildStoredZipArchive(ZIP_ENTRY_NAME, contentBytes);
  const checksum = await computeSha256Hex(archiveBytes);

  return {
    archiveBlob: new Blob([archiveBytes], { type: ZIP_CONTENT_TYPE }),
    archiveBytes,
    checksum,
    contentLength: archiveBytes.byteLength,
    contentType: ZIP_CONTENT_TYPE,
  };
}

export async function parseProjectArchive(
  archiveBuffer: ArrayBuffer,
): Promise<{ checksum: string; content: string; contentLength: number }> {
  const archiveBytes = new Uint8Array(archiveBuffer);
  const checksum = await computeSha256Hex(archiveBytes);
  const contentBytes = readStoredZipArchive(archiveBytes);

  return {
    checksum,
    content: new TextDecoder().decode(contentBytes),
    contentLength: archiveBytes.byteLength,
  };
}

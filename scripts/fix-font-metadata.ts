// Normalize the bundled Noto Sans JP subset's metadata — no external deps.
//
//   npm run fix-font                       # normalize the bundled asset
//   unrun scripts/fix-font-metadata.ts <path.ttf>   # or a given font
//
// The subset's outlines are Regular weight (usWeightClass 400; capital-I stem
// ~92, kanji horizontal stroke ~82 per 1000 em), but its name table and STAT
// axis were mislabeled "Thin" — wrong in OS font pickers and PDF metadata. This
// rewrites the name records to a clean "Noto Sans JP / Regular" and drops the
// single-weight STAT table. Glyph outlines are byte-for-byte untouched.
//
// A small SFNT patcher: it rebuilds only the `name` table, removes `STAT`, and
// recomputes the table directory + checksums. Noto is OFL-licensed without
// reserved font names, so renaming is permitted.
import { readFileSync, writeFileSync } from "node:fs";

const DEFAULT_PATH = "assets/fonts/noto-sans-jp-subset.ttf";

/** name-table records to overwrite, by nameID. */
const NAMES: Record<number, string> = {
  1: "Noto Sans JP", // Family
  2: "Regular", // Subfamily
  3: "2.004;ADBO;NotoSansJP-Regular;ADOBE", // Unique ID
  4: "Noto Sans JP Regular", // Full name
  6: "NotoSansJP-Regular", // PostScript name
  16: "Noto Sans JP", // Typographic Family
  17: "Regular", // Typographic Subfamily
};

const DROP = new Set(["STAT"]);

interface Table {
  tag: string;
  data: Buffer;
}

/** Encode an ASCII string for a name record: UTF-16BE on Windows (platform 3). */
function encodeName(value: string, platformID: number): Buffer {
  return platformID === 3
    ? Buffer.from(value, "utf16le").swap16()
    : Buffer.from(value, "latin1");
}

/** Rebuild the `name` table with normalized strings (format 0 only). */
function rebuildName(data: Buffer): Buffer {
  const format = data.readUInt16BE(0);
  if (format !== 0) {
    throw new Error(`unsupported name table format ${format}`);
  }
  const count = data.readUInt16BE(2);
  const storage = data.readUInt16BE(4);

  const records: Buffer[] = [];
  const strings: Buffer[] = [];
  let strOffset = 0;
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const platformID = data.readUInt16BE(o);
    const encodingID = data.readUInt16BE(o + 2);
    const languageID = data.readUInt16BE(o + 4);
    const nameID = data.readUInt16BE(o + 6);
    const len = data.readUInt16BE(o + 8);
    const off = data.readUInt16BE(o + 10);

    const override = NAMES[nameID];
    const str =
      override !== undefined
        ? encodeName(override, platformID)
        : Buffer.from(data.subarray(storage + off, storage + off + len));

    const rec = Buffer.alloc(12);
    rec.writeUInt16BE(platformID, 0);
    rec.writeUInt16BE(encodingID, 2);
    rec.writeUInt16BE(languageID, 4);
    rec.writeUInt16BE(nameID, 6);
    rec.writeUInt16BE(str.length, 8);
    rec.writeUInt16BE(strOffset, 10);
    records.push(rec);
    strings.push(str);
    strOffset += str.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16BE(0, 0); // format
  header.writeUInt16BE(count, 2);
  header.writeUInt16BE(6 + count * 12, 4); // string storage offset
  return Buffer.concat([header, ...records, ...strings]);
}

function pad4(b: Buffer): Buffer {
  const rem = b.length % 4;
  return rem === 0 ? b : Buffer.concat([b, Buffer.alloc(4 - rem)]);
}

function checksum(b: Buffer): number {
  const p = pad4(b);
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum = (sum + p.readUInt32BE(i)) >>> 0;
  return sum;
}

function normalize(path: string): void {
  const buf = readFileSync(path);
  const sfntVersion = buf.readUInt32BE(0);
  const numTables = buf.readUInt16BE(4);

  const tables: Table[] = [];
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = buf.toString("latin1", o, o + 4);
    const offset = buf.readUInt32BE(o + 8);
    const length = buf.readUInt32BE(o + 12);
    if (DROP.has(tag)) continue;
    let data = Buffer.from(buf.subarray(offset, offset + length));
    if (tag === "name") data = rebuildName(data);
    tables.push({ tag, data });
  }

  // The SFNT directory must be sorted ascending by tag.
  tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  // Zero head.checksumAdjustment before computing checksums; set it last.
  const head = tables.find((t) => t.tag === "head");
  if (head) head.data.writeUInt32BE(0, 8);

  const n = tables.length;
  const entrySelector = Math.floor(Math.log2(n));
  const searchRange = 2 ** entrySelector * 16;
  const offsetTable = Buffer.alloc(12);
  offsetTable.writeUInt32BE(sfntVersion, 0);
  offsetTable.writeUInt16BE(n, 4);
  offsetTable.writeUInt16BE(searchRange, 6);
  offsetTable.writeUInt16BE(entrySelector, 8);
  offsetTable.writeUInt16BE(n * 16 - searchRange, 10);

  const dir = Buffer.alloc(n * 16);
  const bodies: Buffer[] = [];
  let offset = 12 + n * 16;
  let headOffset = 0;
  tables.forEach((t, i) => {
    const o = i * 16;
    dir.write(t.tag, o, 4, "latin1");
    dir.writeUInt32BE(checksum(t.data), o + 4);
    dir.writeUInt32BE(offset, o + 8);
    dir.writeUInt32BE(t.data.length, o + 12);
    if (t.tag === "head") headOffset = offset;
    const padded = pad4(t.data);
    bodies.push(padded);
    offset += padded.length;
  });

  const font = Buffer.concat([offsetTable, dir, ...bodies]);
  const adjustment = (0xb1b0afba - checksum(font)) >>> 0;
  if (headOffset) font.writeUInt32BE(adjustment, headOffset + 8);

  writeFileSync(path, font);
  console.log(`normalized ${path} (${font.length} bytes, ${n} tables)`);
}

normalize(process.argv[2] ?? DEFAULT_PATH);

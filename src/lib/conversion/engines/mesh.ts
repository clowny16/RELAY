/* Mesh engine — worker-safe. STL(ascii+bin)/OBJ/PLY → OBJ / binary STL / GLB. */
import type { ConvertContext, ConversionResultPayload } from "../types";

const dec = new TextDecoder();
const enc = new TextEncoder();

interface Triangle {
  vertices: [number, number, number][];
}

interface Mesh {
  triangles: Triangle[];
  name?: string;
}

/* ---------------- parsers ---------------- */

function parseStlBinary(data: Uint8Array): Mesh {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = dv.getUint32(80, true);
  const expected = 84 + count * 50;
  if (expected !== data.byteLength) {
    // allow trailing bytes but sanity check the count
    if (expected > data.byteLength) throw new Error("Corrupted binary STL — declared triangle count exceeds file size.");
  }
  const triangles: Triangle[] = [];
  let offset = 84;
  for (let i = 0; i < count; i++) {
    offset += 12; // skip normal
    const a: [number, number, number] = [dv.getFloat32(offset, true), dv.getFloat32(offset + 4, true), dv.getFloat32(offset + 8, true)];
    const b: [number, number, number] = [dv.getFloat32(offset + 12, true), dv.getFloat32(offset + 16, true), dv.getFloat32(offset + 20, true)];
    const c: [number, number, number] = [dv.getFloat32(offset + 24, true), dv.getFloat32(offset + 28, true), dv.getFloat32(offset + 32, true)];
    offset += 36 + 2; // vertices + attribute byte count
    triangles.push({ vertices: [a, b, c] });
  }
  return { triangles };
}

function parseStlAscii(text: string): Mesh {
  const triangles: Triangle[] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    triangles.push({
      vertices: [
        [Number(m[1]), Number(m[2]), Number(m[3])],
        [Number(m[4]), Number(m[5]), Number(m[6])],
        [Number(m[7]), Number(m[8]), Number(m[9])],
      ],
    });
  }
  if (!triangles.length) throw new Error("No triangles found in STL file.");
  return { triangles, name: text.match(/solid\s+(\S+)/)?.[1] };
}

function parseStl(data: Uint8Array): Mesh {
  const head = dec.decode(data.slice(0, Math.min(data.length, 512))).trimStart();
  if (/^solid/i.test(head) && !/\f\r?\nsolid/i.test(dec.decode(data.slice(0, Math.min(data.length, 4096))) + "")) {
    // could still be binary with "solid" in header — check size match
    if (data.length >= 84) {
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const count = dv.getUint32(80, true);
      if (84 + count * 50 === data.length) return parseStlBinary(data);
    }
    const text = dec.decode(data);
    if (/facet\s+normal/.test(text)) return parseStlAscii(text);
  }
  if (data.length >= 84) return parseStlBinary(data);
  throw new Error("Unrecognized STL structure.");
}

function parseObj(data: Uint8Array): Mesh {
  const lines = dec.decode(data).split(/\r?\n/);
  const vertices: [number, number, number][] = [];
  const triangles: Triangle[] = [];
  for (const line of lines) {
    if (line.startsWith("v ")) {
      const p = line.trim().split(/\s+/);
      vertices.push([Number(p[1]), Number(p[2]), Number(p[3])]);
    } else if (line.startsWith("f ")) {
      const p = line.trim().split(/\s+/).slice(1).map((tok) => {
        const idx = parseInt(tok.split("/")[0], 10);
        return idx < 0 ? vertices.length + idx : idx - 1;
      });
      // fan-triangulate polygons
      for (let i = 1; i < p.length - 1; i++) {
        triangles.push({ vertices: [vertices[p[0]], vertices[p[i]], vertices[p[i + 1]]].filter(Boolean) as [number, number, number][] });
      }
    }
  }
  if (!triangles.length) throw new Error("No faces found in OBJ file.");
  return { triangles };
}

function parsePly(data: Uint8Array): Mesh {
  const headText = dec.decode(data.slice(0, Math.min(data.length, 4096)));
  if (!headText.startsWith("ply")) throw new Error("Not a PLY file.");
  const isAscii = /format ascii/.test(headText);
  const faceCount = Number(headText.match(/element face (\d+)/)?.[1] ?? 0);
  const vertexCount = Number(headText.match(/element vertex (\d+)/)?.[1] ?? 0);
  const endIdx = headText.indexOf("end_header");
  if (endIdx < 0) throw new Error("Corrupted PLY — no end_header found.");
  // ASCII header ⇒ byte offset == char offset
  const headerEnd = endIdx + "end_header\n".length;

  const triangles: Triangle[] = [];
  if (isAscii) {
    const text = dec.decode(data.slice(headerEnd)).trim().split(/\r?\n/);
    const vertices: [number, number, number][] = [];
    for (let i = 0; i < vertexCount; i++) {
      const p = text[i]?.trim().split(/\s+/) ?? [];
      vertices.push([Number(p[0]), Number(p[1]), Number(p[2])]);
    }
    for (let i = vertexCount; i < text.length && triangles.length < faceCount; i++) {
      const p = text[i]?.trim().split(/\s+/).map(Number) ?? [];
      const n = p[0];
      if (n >= 3) {
        for (let k = 1; k < n - 1; k++) {
          triangles.push({ vertices: [vertices[p[1]], vertices[p[k + 1]], vertices[p[k + 2]]].filter(Boolean) as [number, number, number][] });
        }
      }
    }
  } else {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = headerEnd;
    const vertices: [number, number, number][] = [];
    for (let i = 0; i < vertexCount; i++) {
      vertices.push([dv.getFloat32(offset, true), dv.getFloat32(offset + 4, true), dv.getFloat32(offset + 8, true)]);
      offset += 12;
    }
    for (let i = 0; i < faceCount; i++) {
      const n = dv.getUint8(offset);
      offset += 1;
      const idx: number[] = [];
      for (let k = 0; k < n; k++) {
        idx.push(dv.getUint32(offset, true));
        offset += 4;
      }
      for (let k = 1; k < n - 1; k++) {
        triangles.push({ vertices: [vertices[idx[0]], vertices[idx[k]], vertices[idx[k + 1]]].filter(Boolean) as [number, number, number][] });
      }
    }
  }
  if (!triangles.length) throw new Error("No faces found in PLY file (only vertex/face properties supported).");
  return { triangles };
}

/* ---------------- serializers ---------------- */

function toObj(mesh: Mesh): string {
  const parts: string[] = ["# Converted by RELAY (local)"];
  if (mesh.name) parts.push(`o ${mesh.name}`);
  const index = new Map<string, number>();
  const ordered: [number, number, number][] = [];
  const faces: number[][] = [];
  for (const t of mesh.triangles) {
    const face: number[] = [];
    for (const v of t.vertices) {
      const key = v.join(",");
      let id = index.get(key);
      if (!id) {
        ordered.push(v);
        id = ordered.length;
        index.set(key, id);
      }
      face.push(id);
    }
    faces.push(face);
  }
  for (const v of ordered) parts.push(`v ${v[0]} ${v[1]} ${v[2]}`);
  for (const f of faces) parts.push(`f ${f.join(" ")}`);
  return parts.join("\n") + "\n";
}

function toBinaryStl(mesh: Mesh): Uint8Array {
  const count = mesh.triangles.length;
  const out = new ArrayBuffer(84 + count * 50);
  const dv = new DataView(out);
  const header = enc.encode("RELAY local STL export".padEnd(80, "\0"));
  new Uint8Array(out).set(header.subarray(0, 80), 0);
  dv.setUint32(80, count, true);
  let offset = 84;
  for (const t of mesh.triangles) {
    // compute normal
    const [a, b, c] = t.vertices;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    dv.setFloat32(offset, nx, true); dv.setFloat32(offset + 4, ny, true); dv.setFloat32(offset + 8, nz, true);
    offset += 12;
    for (const v of t.vertices) {
      dv.setFloat32(offset, v[0], true);
      dv.setFloat32(offset + 4, v[1], true);
      dv.setFloat32(offset + 8, v[2], true);
      offset += 12;
    }
    dv.setUint16(offset, 0, true);
    offset += 2;
  }
  return new Uint8Array(out);
}

function toGlb(mesh: Mesh): Uint8Array {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const t of mesh.triangles) {
    const base = positions.length / 3;
    for (const v of t.vertices) positions.push(v[0], v[1], v[2]);
    indices.push(base, base + 1, base + 2);
  }
  const posBuf = new Float32Array(positions);
  const idxBuf = indices.length <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices);
  const posBytes = new Uint8Array(posBuf.buffer);
  const idxBytes = new Uint8Array(idxBuf.buffer);
  const componentType = indices.length <= 65535 ? 5123 : 5125;

  // pad binary chunk
  const pad4 = (n: number) => (4 - (n % 4)) % 4;
  const binLen = posBytes.length + idxBytes.length;
  const binPadded = binLen + pad4(binLen);
  const gltf = {
    asset: { version: "2.0", generator: "RELAY local mesh converter" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binPadded }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: [Math.min(...positions)], max: [Math.max(...positions)] },
      { bufferView: 1, componentType, count: indices.length, type: "SCALAR" },
    ],
  };
  // fix accessor min/max arrays
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  (gltf.accessors[0].min as number[]) = min;
  (gltf.accessors[0].max as number[]) = max;

  const jsonStr = JSON.stringify(gltf);
  const jsonBytes = enc.encode(jsonStr);
  const jsonPadded = jsonBytes.length + pad4(jsonBytes.length);

  const headerSize = 12;
  const total = headerSize + 8 + jsonPadded + 8 + binPadded;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  // JSON chunk
  dv.setUint32(12, jsonPadded, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  u8.set(jsonBytes, 20);
  // BIN chunk
  const binStart = 20 + jsonPadded;
  dv.setUint32(binStart, binPadded, true);
  dv.setUint32(binStart + 4, 0x004e4942, true); // 'BIN\0'
  u8.set(posBytes, binStart + 8);
  u8.set(idxBytes, binStart + 8 + posBytes.length);
  return new Uint8Array(out);
}

/* ---------------- main ---------------- */

export async function convertMesh(ctx: ConvertContext, buffer: ArrayBuffer, onProgressDetail?: (d: string) => void): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat } = ctx;
  void onProgressDetail;
  let mesh: Mesh;
  switch (inputFormat) {
    case "stl": mesh = parseStl(new Uint8Array(buffer)); break;
    case "obj": mesh = parseObj(new Uint8Array(buffer)); break;
    case "ply": mesh = parsePly(new Uint8Array(buffer)); break;
    default: throw new Error(`${inputFormat.toUpperCase()} parsing is not supported in-browser.`);
  }

  switch (outputFormat) {
    case "obj":
      return { bytes: enc.encode(toObj(mesh)), mime: "model/obj", ext: "obj", meta: { triangles: mesh.triangles.length } };
    case "stl":
      return { bytes: toBinaryStl(mesh), mime: "model/stl", ext: "stl", meta: { triangles: mesh.triangles.length } };
    case "glb":
      return { bytes: toGlb(mesh), mime: "model/gltf-binary", ext: "glb", meta: { triangles: mesh.triangles.length } };
    default:
      throw new Error(`${outputFormat.toUpperCase()} mesh output not supported.`);
  }
}

/**
 * Acquires the versioned Georef (datos.gob.ar) v2.1 snapshots used by the checkout location selectors.
 * Run manually: `npx tsx scripts/fetch-georef-snapshot.ts`. The app never calls Georef at runtime.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://apis.datos.gob.ar/georef/api/v2.1";
const PAGE_SIZE = 1000;
const OUTPUT_DIR = join(process.cwd(), "src", "lib", "data", "locations", "snapshots");

type ProvinceRecord = { id: string; nombre: string };
type LocalityRecord = { id: string; nombre: string; provincia: { id: string; nombre: string } };

async function getJson<T>(path: string): Promise<T> {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const response = await fetch(`${API}${path}`);
    if (response.ok) return response.json() as Promise<T>;
    if (response.status !== 429 || attempt === 6) throw new Error(`Georef ${path} responded ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`Georef ${path} exhausted retries`);
}

async function fetchProvinces(): Promise<ProvinceRecord[]> {
  const body = await getJson<{ provincias: ProvinceRecord[]; total: number }>("/provincias?campos=id,nombre&max=100");
  if (body.provincias.length !== body.total || body.total !== 24) throw new Error(`Expected 24 provinces, got ${body.provincias.length}/${body.total}`);
  return body.provincias.sort((left, right) => left.id.localeCompare(right.id));
}

async function fetchLocalities(province: ProvinceRecord): Promise<LocalityRecord[]> {
  const records: LocalityRecord[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (records.length < total) {
    const body = await getJson<{ localidades: LocalityRecord[]; total: number }>(
      `/localidades?provincia=${province.id}&campos=id,nombre,provincia&max=${PAGE_SIZE}&inicio=${records.length}`,
    );
    total = body.total;
    if (body.localidades.length === 0) break;
    records.push(...body.localidades);
  }
  if (records.length !== total) throw new Error(`Province ${province.id}: collected ${records.length} of ${total}`);
  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) throw new Error(`Province ${province.id}: duplicate locality ids`);
  const foreign = records.find((record) => record.provincia.id !== province.id);
  if (foreign) throw new Error(`Province ${province.id}: locality ${foreign.id} belongs to ${foreign.provincia.id}`);
  return records;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  mkdirSync(join(OUTPUT_DIR, "localities"), { recursive: true });
  const provinces = await fetchProvinces();
  const manifestProvinces: Array<{ id: string; localities: number; checksum: string }> = [];

  for (const province of provinces) {
    const localities = (await fetchLocalities(province))
      .map((record) => [record.id, record.nombre] as [string, string])
      .sort((left, right) => left[1].localeCompare(right[1], "es") || left[0].localeCompare(right[0]));
    const content = `${JSON.stringify(localities)}\n`;
    writeFileSync(join(OUTPUT_DIR, "localities", `${province.id}.json`), content);
    manifestProvinces.push({ checksum: sha256(content), id: province.id, localities: localities.length });
    process.stdout.write(`${province.id} ${province.nombre}: ${localities.length}\n`);
  }

  const provincesContent = `${JSON.stringify(provinces.map((province) => ({ id: province.id, name: province.nombre })))}\n`;
  writeFileSync(join(OUTPUT_DIR, "provinces.json"), provincesContent);
  const manifest = {
    apiVersion: "georef-v2.1",
    localityTotal: manifestProvinces.reduce((sum, entry) => sum + entry.localities, 0),
    provinces: manifestProvinces,
    provincesChecksum: sha256(provincesContent),
    provincesCount: provinces.length,
    retrievedAt: new Date().toISOString(),
    sourceUrl: API,
  };
  writeFileSync(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Total localities: ${manifest.localityTotal}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Georef snapshot failed."}\n`);
  process.exitCode = 1;
});

/**
 * Genera fixtures/notas_SEMANA_DEMO.xlsx para import demo en Asis Academy.
 * Uso: node scripts/asisacademy/gen_notas_fixture.mjs
 */
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'fixtures');
const outFile = path.join(outDir, 'notas_SEMANA_DEMO.xlsx');

const rows = [
  ['DNI', 'Nombre', 'Nota', 'Carrera', 'Área', 'Observación'],
  ['76273860', 'Andre Mendez CIsneros', 18.5, 'Ingeniería de Sistemas / Software', 'ingenierias', 'Demo'],
  ['81166552', 'Dayana Garcia', 16, 'Medicina Humana', 'salud', ''],
  ['61708962', 'ENRIQUEZ QUISPE CLEIDY GIMENA', 19, 'Enfermería', 'salud', ''],
  ['61383827', 'fabian mendez', 14.5, 'Derecho / Ciencias Políticas', 'letras', ''],
  ['76127901', 'HUAMANI ESPINOZA NICK REY YEFER', 17, 'Ingeniería Civil', 'ingenierias', ''],
  ['70391919', 'Jeremi Isac Espino Escriba', 15, 'Administración de Empresas', 'letras', ''],
  ['92010007', 'ALARCON RUIZ CAMILA SOFIA', 20, 'Medicina Humana', 'salud', 'Top'],
  ['92010008', 'BENAVIDES TORRES LUIS ENRIQUE', 12, 'Ingeniería de Sistemas / Software', 'ingenierias', ''],
  ['92010009', 'CASTRO MENDOZA ANA LUCIA', 13.5, 'Educación', 'letras', ''],
  ['92010010', 'DELGADO QUIROZ PEDRO ANTONIO', 11, 'Contabilidad / Economía', 'letras', ''],
  ['92010019', 'NAVARRO DIAZ PAULA', 18, 'Odontología / Estomatología', 'salud', ''],
  ['92010020', 'ORTEGA VARGAS SEBASTIAN', 9.5, 'Arquitectura', 'ingenierias', ''],
];

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Notas');
for (const r of rows) ws.addRow(r);

await mkdir(outDir, { recursive: true });
const buf = await wb.xlsx.writeBuffer();
await writeFile(outFile, Buffer.from(buf));
console.log('Wrote', outFile);

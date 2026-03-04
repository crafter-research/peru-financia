import * as XLSX from "xlsx";

const wb = XLSX.readFile(`${process.env.HOME}/Downloads/claridad/claridad-eg2021-e1.xlsx`);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

for (let i = 0; i < Math.min(10, rows.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}

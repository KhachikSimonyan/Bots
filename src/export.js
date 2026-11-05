// The workbook uses numeric Excel dates and inline strings. No network request is needed to export.
const KhnayikExport = (() => {
  const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const officeRelations = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRelations = "http://schemas.openxmlformats.org/package/2006/relationships";
  const encoder = new TextEncoder();

  function xml(value) {
    return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function csv(rows) {
    const lines = rows.map((row) => row.map((value) => {
      let text = String(value ?? "");
      if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    }).join(","));
    return new Blob(["\uFEFF", lines.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" });
  }

  function cell(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      const localTime = value.getTime() - value.getTimezoneOffset() * 60000;
      return `<c s="1"><v>${localTime / 86400000 + 25569}</v></c>`;
    }
    if (typeof value === "number" && Number.isFinite(value)) return `<c><v>${value}</v></c>`;
    return `<c t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }

  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    return crc;
  });

  // Stored ZIP entries have the same uncompressed and compressed length.
  function zip(files) {
    const entries = [];
    const directory = [];
    let offset = 0;
    let directorySize = 0;
    for (const [path, contents] of Object.entries(files)) {
      const name = encoder.encode(path);
      const data = encoder.encode(contents);
      let crc = 0xffffffff;
      for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
      crc = (crc ^ 0xffffffff) >>> 0;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(12, 0x21, true); // 1980-01-01 in the ZIP date field
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      entries.push(local, name, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      new Uint8Array(central.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
      central.setUint32(42, offset, true);
      directory.push(central, name);
      directorySize += central.byteLength + name.length;
      offset += local.byteLength + name.length + data.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    const count = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
    return new Blob([...entries, ...directory, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function workbook(tables) {
    const files = {};
    const sheets = [];
    const links = [];
    const overrides = [];
    tables.forEach(({ name, rows }, index) => {
      const id = index + 1;
      const path = `worksheets/sheet${id}.xml`;
      const data = rows.map((row) => "<row>" + row.map(cell).join("") + "</row>").join("");
      files["xl/" + path] = `<worksheet xmlns="${spreadsheet}"><cols><col min="1" max="${rows[0].length}" width="24" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>`;
      sheets.push(`<sheet name="${xml(name)}" sheetId="${id}" r:id="rId${id}"/>`);
      links.push(`<Relationship Id="rId${id}" Type="${officeRelations}/worksheet" Target="${path}"/>`);
      overrides.push(`<Override PartName="/xl/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    });
    files["[Content_Types].xml"] = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides.join("")}</Types>`;
    files["_rels/.rels"] = `<Relationships xmlns="${packageRelations}"><Relationship Id="rId1" Type="${officeRelations}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    files["xl/workbook.xml"] = `<workbook xmlns="${spreadsheet}" xmlns:r="${officeRelations}"><sheets>${sheets.join("")}</sheets></workbook>`;
    files["xl/_rels/workbook.xml.rels"] = `<Relationships xmlns="${packageRelations}">${links.join("")}<Relationship Id="styles" Type="${officeRelations}/styles" Target="styles.xml"/></Relationships>`;
    files["xl/styles.xml"] = `<styleSheet xmlns="${spreadsheet}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return zip(files);
  }

  return { csv, workbook };
})();

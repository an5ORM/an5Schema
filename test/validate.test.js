/**
 * an5Schema validation tests.
 * Validates .an5 schema file format and syntax:
 * - .an5 file discovery and content validation
 * - Model declaration syntax (model Name { ... })
 * - Field type validation (SQL Server types, mirrored from an5Orm parser)
 * - Attribute validation (@id, @default(), @unique, @relation, ...)
 * - Brace matching and nesting
 * - Directive syntax (@@map, @@unique, @@index, @@schema, @@description)
 *
 * Run: npm test (node test/validate.test.js)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// The SQL Server types from an5Orm/generator/src/field-types.ts
// (PROVIDER_FIELD_TYPES.mssql). Valid types are per provider — the other
// providers each have their own table there — and these sample schemas target
// SQL Server.
const KNOWN_TYPES = new Set([
  'NVARCHAR', 'VARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT', 'XML',
  'INT', 'SMALLINT', 'TINYINT', 'BIGINT', 'FLOAT', 'REAL',
  'DECIMAL', 'NUMERIC', 'MONEY', 'SMALLMONEY',
  'BIT',
  'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'DATE', 'TIME', 'DATETIMEOFFSET',
  'VARBINARY', 'BINARY', 'IMAGE',
  // `TIMESTAMP` is rowversion, `SYSNAME` is NVARCHAR(128); both are written by
  // db:pull, so a pulled schema has to validate here too.
  'TIMESTAMP', 'SYSNAME',
  'UNIQUEIDENTIFIER', 'SQL_VARIANT', 'ROWVERSION',
  'HIERARCHYID', 'GEOGRAPHY', 'GEOMETRY', 'VECTOR',
]);

const KNOWN_FIELD_ATTRS = new Set(['id', 'unique', 'default', 'description', 'relation', 'updatedAt']);
const KNOWN_DIRECTIVES = new Set(['map', 'schema', 'unique', 'index', 'description']);

const schemaDir = path.join(__dirname, '..');
const schemaFiles = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.an5'));

function stripLineComment(line) {
  // Remove // comments (schema has no // inside string literals in practice)
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

function checkBracesBalanced(text, label) {
  // Strip string literals so braces inside descriptions don't count
  const stripped = text.replace(/"([^"\\]|\\.)*"/g, '""');
  let depth = 0;
  for (const ch of stripped) {
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      assert.ok(depth >= 0, `${label}: closing brace without opening brace`);
    }
  }
  assert.strictEqual(depth, 0, `${label}: unbalanced braces (depth ${depth})`);
  return depth;
}

function parseModels(text) {
  // Minimal structural parse: returns [{ name, fields: [line], directives: [line] }]
  const models = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = stripLineComment(raw).trim();
    if (!line) continue;
    const header = line.match(/^model\s+(\w+)\s*\{$/);
    if (header) {
      current = { name: header[1], fields: [], directives: [] };
      models.push(current);
      continue;
    }
    if (line === '}') {
      current = null;
      continue;
    }
    if (current) {
      if (line.startsWith('@@')) current.directives.push(line);
      else current.fields.push(line);
    }
  }
  return models;
}

function validateFieldType(fieldType, label) {
  const clean = fieldType.replace(/\[\]$/, '').replace(/\?$/, '');
  const baseMatch = clean.match(/^(\w+)(?:\(.+\))?$/);
  assert.ok(baseMatch, `${label}: malformed field type "${fieldType}"`);
  const base = baseMatch[1].toUpperCase();
  // Relation reference: Uppercase model name without parens (mirrors parser heuristic)
  const isRelationRef = /^[A-Z]\w*$/.test(baseMatch[1]) && !clean.includes('(') && !KNOWN_TYPES.has(base);
  if (!isRelationRef) {
    assert.ok(KNOWN_TYPES.has(base), `${label}: unknown SQL type "${fieldType}"`);
  }
  return isRelationRef;
}

function validateAttributes(line, label) {
  for (const m of line.matchAll(/@(\w+)/g)) {
    // Skip @@directives handled separately
    const atIdx = line.indexOf('@' + m[1]);
    if (line[atIdx - 1] === '@') continue;
    assert.ok(
      KNOWN_FIELD_ATTRS.has(m[1]),
      `${label}: unknown attribute "@${m[1]}" in "${line.trim()}"`
    );
  }
}

console.log('an5Schema validation tests:');

test('discovers .an5 schema files', () => {
  assert.ok(schemaFiles.length > 0, 'expected at least one .an5 file');
  for (const f of schemaFiles) {
    const stat = fs.statSync(path.join(schemaDir, f));
    assert.ok(stat.size > 0, `${f} is empty`);
  }
});

for (const file of schemaFiles) {
  const text = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  const label = file;

  test(`${label}: braces are balanced`, () => {
    checkBracesBalanced(text, label);
  });

  test(`${label}: declares at least one model`, () => {
    const models = parseModels(text);
    assert.ok(models.length > 0, `${label}: no "model Name {" declaration found`);
    for (const m of models) {
      assert.ok(/^[A-Z]\w*$/.test(m.name), `${label}: model name "${m.name}" should be PascalCase`);
      assert.ok(m.fields.length > 0, `${label}: model "${m.name}" has no fields`);
    }
  });

  test(`${label}: field types are known SQL Server types or relation refs`, () => {
    for (const m of parseModels(text)) {
      for (const fieldLine of m.fields) {
        const parts = fieldLine.split(/\s+/);
        assert.ok(parts.length >= 2, `${label}: malformed field line "${fieldLine.trim()}"`);
        validateFieldType(parts[1], `${label} model ${m.name}`);
      }
    }
  });

  test(`${label}: field attributes are known`, () => {
    for (const m of parseModels(text)) {
      for (const fieldLine of m.fields) {
        validateAttributes(fieldLine, `${label} model ${m.name}`);
      }
    }
  });

  test(`${label}: at most one @id per model`, () => {
    for (const m of parseModels(text)) {
      const idCount = m.fields.filter((l) => /(^|\s)@id(\s|$)/.test(l)).length;
      assert.ok(idCount <= 1, `${label}: model "${m.name}" has ${idCount} @id fields`);
    }
  });

  test(`${label}: directives use known @@names with balanced parens`, () => {
    for (const m of parseModels(text)) {
      for (const d of m.directives) {
        const name = d.match(/^@@(\w+)/);
        assert.ok(name, `${label}: malformed directive "${d.trim()}"`);
        assert.ok(KNOWN_DIRECTIVES.has(name[1]), `${label}: unknown directive "@@${name[1]}"`);
        const open = (d.match(/\(/g) || []).length;
        const close = (d.match(/\)/g) || []).length;
        assert.strictEqual(open, close, `${label}: unbalanced parens in "${d.trim()}"`);
      }
    }
  });
}

// Negative cases: validator logic must reject broken snippets
test('rejects unbalanced braces', () => {
  assert.throws(() => checkBracesBalanced('model Foo {', 'neg'), /unbalanced/);
});

test('rejects unknown field type', () => {
  assert.throws(() => validateFieldType('STRINGY(10)', 'neg'), /unknown SQL type/);
});

test('rejects unknown attribute', () => {
  assert.throws(() => validateAttributes('id INT @primary', 'neg'), /unknown attribute/);
});

test('accepts relation reference fields', () => {
  assert.strictEqual(validateFieldType('Post[]', 'neg'), true);
  assert.strictEqual(validateFieldType('Profile?', 'neg'), true);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);

# an5Schema

Sample schema definitions for AN5 ORM. Contains `.an5` files that define models using SQL Server native types.

## Structure

```
an5Schema/
├── test1.an5    # User model
├── test2.an5    # Order model
└── package.json
```

## Schema Syntax

### Models

```an5
model ModelName {
  fieldName SQL_TYPE [attributes]
}
```

### SQL Server Types

| Type | Description |
|------|-------------|
| `NVARCHAR(n)` | Unicode string with length |
| `VARCHAR(n)` | Non-unicode string |
| `CHAR(n)` | Fixed-length string |
| `NCHAR(n)` | Fixed-length unicode string |
| `TEXT` / `NTEXT` | Large text |
| `INT` | Integer |
| `SMALLINT` | Small integer |
| `TINYINT` | Tiny integer |
| `BIGINT` | Large integer |
| `FLOAT` | Floating point |
| `REAL` | Real number |
| `DECIMAL(p,s)` | Decimal with precision/scale |
| `NUMERIC(p,s)` | Numeric with precision/scale |
| `MONEY` / `SMALLMONEY` | Currency |
| `BIT` | Boolean (0/1) |
| `DATETIME` / `DATETIME2` | Date and time |
| `SMALLDATETIME` | Small date/time |
| `DATE` | Date only |
| `TIME` | Time only |
| `DATETIMEOFFSET` | Date/time with timezone |
| `VARBINARY(n)` | Variable binary |
| `BINARY(n)` | Fixed binary |
| `IMAGE` | Binary large object |
| `UNIQUEIDENTIFIER` | GUID |
| `XML` | XML data |
| `VECTOR(n)` | Embedding vector |

### Attributes

| Attribute | Description |
|-----------|-------------|
| `@id` | Primary key |
| `@unique` | Unique constraint |
| `@default(value)` | Default value |
| `@updatedAt` | Auto-update timestamp |
| `@relation(...)` | Foreign key relation |

### Block Attributes

| Attribute | Description |
|-----------|-------------|
| `@@map("table")` | Map to table name |
| `@@schema("schema")` | Map to schema |
| `@@unique([fields])` | Compound unique |
| `@@index([fields])` | Index |

## Example

```an5
model User {
  id        NVARCHAR(1000) @id @default(uuid())
  email     NVARCHAR(255)  @unique
  name      NVARCHAR(255)?
  createdAt DATETIME2      @default(now())

  @@map("users")
}

model Order {
  id        NVARCHAR(1000) @id @default(uuid())
  userId    NVARCHAR(1000)
  total     INT            @default(0)
  createdAt DATETIME2      @default(now())
  user      User           @relation(fields: [userId], references: [id])

  @@map("orders")
}
```

## Usage

These schema files are used by:

1. **an5Orm/generator** — Generates TypeScript, Python, and .NET code
2. **an5Orm/push** — Creates/updates database tables
3. **an5Orm/pull** — Introspects database and updates schema
4. **an5OrmVScode** — Provides syntax highlighting and formatting

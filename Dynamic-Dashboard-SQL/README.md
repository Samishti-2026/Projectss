# Dynamic Dashboard SQL

A Node.js backend for dynamic SQL dashboard generation with automatic JOIN planning, type coercion, and query configuration management.

## Features

- **Dynamic Query Generation**: Automatic SQL query building with multi-table JOINs
- **Query Configuration Storage**: Save and reuse query templates
- **Type Coercion Engine**: Automatic data type detection and conversion
- **Schema Analysis**: Automatic relationship discovery and optimization suggestions
- **Result Enhancement**: Field name resolution and related data embedding
- **Security**: Multi-layer validation, SQL injection prevention, rate limiting

## Architecture

```
server.js → joinPlanner.js → pathResolver.js → relations.js
     ↓
sqlQueryBuilder.js → filterBuilderSQL.js → [embedded operators]
db.js (MySQL connection)
```

## API Endpoints

### Query Execution
- `POST /query` - Execute dynamic SQL queries
- `GET /all-fields/:database` - Get available fields
- `GET /debug/:database/:table` - Inspect table data

### Query Configuration
- `POST /save-query-config` - Save query template
- `GET /query-configs` - List saved configurations
- `GET /query-configs/:id` - Get specific configuration
- `PUT /query-configs/:id` - Update configuration
- `DELETE /query-configs/:id` - Delete configuration
- `GET /search-query-configs?q=searchterm` - Search configurations

## Setup

1. Install dependencies: `npm install`
2. Configure MySQL in `.env`:
   ```
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=dynamic_dashboard
   ```
3. Start server: `npm start`

## Key Components

- **joinPlanner.js**: Automatic JOIN path calculation
- **pathResolver.js**: Shortest path traversal
- **resultEnhancer.js**: Result field resolution
- **schemaAnalyzer.js**: Relationship discovery
- **typeCoercer.js**: Automatic type conversion
- **queryConfigManager.js**: Query template persistence

## Security Features

- Input validation (whitelist approach)
- SQL injection prevention (parameterized queries)
- Rate limiting (100 requests/15min)
- XSS protection headers
- Payload size limits

## Test Cases

See `Test Case.txt` for example query scenarios covering:
- Simple filters
- Multi-table JOINs
- Aggregation operations
- String operations
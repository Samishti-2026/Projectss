# PostgreSQL Migration Guide

## Migration Summary

Your MongoDB project has been successfully converted to PostgreSQL! Here are the key changes made:

## Files Modified

1. **package.json** - Replaced `mongodb` dependency with `pg` (PostgreSQL client)
2. **db.js** - Complete rewrite to use PostgreSQL connection pooling
3. **operators.js** - Converted MongoDB operators to PostgreSQL syntax
4. **filterBuilder.js** - Rewritten to generate PostgreSQL WHERE clauses
5. **joinPlanner.js** - Updated to generate PostgreSQL JOIN syntax
6. **server.js** - Major rewrite of all endpoints to use PostgreSQL queries
7. **.env** - Updated with PostgreSQL connection configuration

## Key Changes

### Database Connection

- **Before**: MongoDB connection with `MongoClient`
- **After**: PostgreSQL connection pool with `pg.Pool`

### Query Syntax

- **Before**: MongoDB aggregation pipelines (`$match`, `$lookup`, `$group`)
- **After**: PostgreSQL SQL queries (`WHERE`, `JOIN`, `GROUP BY`)

### Operators

- **Before**: MongoDB operators (`$eq`, `$gt`, `$regex`, etc.)
- **After**: PostgreSQL operators (`=`, `>`, `ILIKE`, etc.)

### Data Types

- **Before**: MongoDB ObjectId, flexible schema
- **After**: PostgreSQL SERIAL/INTEGER IDs, structured schema

## Configuration

Update your `.env` file with your actual PostgreSQL credentials:

```env
# PostgreSQL Connection Configuration
PG_USER=your_username
PG_HOST=your_host  # usually localhost
PG_DATABASE=your_database_name
PG_PASSWORD=your_password
PG_PORT=5432  # default PostgreSQL port

# Application Configuration
NODE_ENV=production
PORT=3000
```

## Database Schema Requirements

Your PostgreSQL database should have tables that match your MongoDB collections. For example:

```sql
-- Example table structure
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    product_id INTEGER,
    category_id INTEGER,
    amount DECIMAL(10,2),
    invoice_date DATE,
    -- other fields...
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    region VARCHAR(100),
    zone VARCHAR(100)
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category_id INTEGER,
    price DECIMAL(10,2)
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255)
);
```

## Testing

1. **Start the server**: `npm start`
2. **Test connection**: `node test-postgres.js`
3. **Test endpoints**: Use tools like Postman or curl to test the API endpoints

## API Endpoints (Unchanged)

All existing endpoints work the same way, but now use PostgreSQL:

- `POST /query` - Execute dynamic queries
- `GET /all-fields/:database` - Get available fields
- `GET /debug/:database/:table` - Debug table data
- `POST /save-query-config` - Save query configurations
- `GET /query-configs` - Get saved configurations
- `DELETE /query-config/:id` - Delete configuration

## Important Notes

1. **Field Names**: PostgreSQL uses snake_case by convention (e.g., `customer_id` instead of `customerId`)
2. **JOINs**: Relationships are now handled with SQL JOINs instead of MongoDB `$lookup`
3. **Aggregations**: GROUP BY and aggregate functions are used instead of MongoDB aggregation pipelines
4. **Data Types**: Make sure your PostgreSQL schema matches your expected data types
5. **IDs**: PostgreSQL uses SERIAL/INTEGER for IDs instead of MongoDB's ObjectId

## Troubleshooting

If you encounter connection issues:

1. Verify PostgreSQL is running
2. Check your credentials in `.env`
3. Ensure the database exists
4. Verify network connectivity if using remote PostgreSQL

The migration preserves all functionality while switching from MongoDB to PostgreSQL backend!

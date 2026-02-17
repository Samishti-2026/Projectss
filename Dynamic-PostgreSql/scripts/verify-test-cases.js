
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/query';
const DATABASE = 'dashboard';

const TEST_CASES = [
  {
    id: 1,
    description: "customers where region == West and zone == Pune",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'region', operator: 'eq', value: 'West' },
        { collection: 'customers', field: 'zone', operator: 'eq', value: 'Pune' }
      ]
    }
  },
  {
    id: 2,
    description: "customers (West/Pune) and invoices.invoice_date = 2026-01-20",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'region', operator: 'eq', value: 'West' },
        { collection: 'customers', field: 'zone', operator: 'eq', value: 'Pune' },
        { collection: 'invoices', field: 'invoice_date', operator: 'eq', value: '2026-01-20' }
      ]
    }
  },
  {
    id: 3,
    description: "customers (West/Pune) where categories.name == Bakery",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'region', operator: 'eq', value: 'West' },
        { collection: 'customers', field: 'zone', operator: 'eq', value: 'Pune' },
        { collection: 'categories', field: 'name', operator: 'eq', value: 'Bakery' }
      ]
    }
  },
  {
    id: 4,
    description: "customers (West/Pune) where products.name == Bread",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'region', operator: 'eq', value: 'West' },
        { collection: 'customers', field: 'zone', operator: 'eq', value: 'Pune' },
        { collection: 'products', field: 'name', operator: 'eq', value: 'Bread' }
      ]
    }
  },
  {
    id: 5,
    description: "customers.name starts with S",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'name', operator: 'startsWith', value: 'S' }
      ]
    }
  },
  {
    id: 6,
    description: "all invoices where products.name == Laptop",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'products', field: 'name', operator: 'eq', value: 'Laptop' }
      ]
    }
  },
  {
    id: 7,
    description: "SUM(total_amount) where region=West, zone=Pune, product=Laptop",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'region', operator: 'eq', value: 'West' },
        { collection: 'customers', field: 'zone', operator: 'eq', value: 'Pune' },
        { collection: 'products', field: 'name', operator: 'eq', value: 'Laptop' }
      ],
      aggregation: [
        { operator: 'sum', collection: 'invoices', field: 'total_amount', alias: 'total_sales' }
      ]
    }
  },
  {
    id: 8,
    description: "SUM(total_amount) from invoices where customer == Sahil",
    payload: {
      database: DATABASE,
      filters: [
        { collection: 'customers', field: 'name', operator: 'eq', value: 'Sahil' }
      ],
      aggregation: [
        { operator: 'sum', collection: 'invoices', field: 'total_amount', alias: 'total_sales' }
      ]
    }
  }
];

async function runTests() {
  console.log(`Running ${TEST_CASES.length} test cases...\n`);

  for (const test of TEST_CASES) {
    console.log(`--- Test Case ${test.id}: ${test.description} ---`);
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`FAILED (Status ${res.status}): ${text}\n`);
        continue;
      }

      const data = await res.json();

      if (data.type === 'both' || data.aggregation_data) {
        console.log(`SUCCESS: Aggregation Result:`);
        console.table(data.aggregation_data);
        console.log(`Derived SQL: ${data.aggregation_query}\n`);
      } else {
        console.log(`SUCCESS: Found ${data.count} records`);
        if (data.count > 0) {
          console.log(`Sample Data:`, JSON.stringify(data.data[0], null, 2));
        }
        console.log(`Derived SQL: ${data.query}\n`);
      }

    } catch (err) {
      console.error(`ERROR: ${err.message}\n`);
    }
  }
}

runTests();


import 'dotenv/config';
import { query, queryTransaction } from '../db.js';

async function seedInvoices() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Fetch existing Customers
    console.log('Fetching customers...');
    const customersResult = await query('SELECT id FROM customers', []);
    const customers = customersResult.rows;
    if (customers.length === 0) {
      throw new Error('No customers found! Cannot seed invoices without customers.');
    }
    console.log(`✅ Found ${customers.length} customers.`);

    // 2. Fetch existing Products (and their categories/prices)
    console.log('Fetching products...');
    const productsResult = await query('SELECT id, price, category_id FROM products', []);
    const products = productsResult.rows;
    if (products.length === 0) {
      throw new Error('No products found! Cannot seed invoices without products.');
    }
    console.log(`✅ Found ${products.length} products.`);

    // 3. Generate Random Invoices
    const INVOICES_TO_GENERATE = 20;
    const newInvoices = [];

    console.log(`Generating ${INVOICES_TO_GENERATE} random invoices...`);

    for (let i = 0; i < INVOICES_TO_GENERATE; i++) {
      // Random Customer
      const customer = customers[Math.floor(Math.random() * customers.length)];

      // Random Product
      const product = products[Math.floor(Math.random() * products.length)];

      // Random Quantity (1-10)
      const quantity = Math.floor(Math.random() * 10) + 1;

      // Calculate Amount
      // Price might be string from DB, parse it
      const price = parseFloat(product.price);
      const totalAmount = (price * quantity).toFixed(2);

      // Random Date (within last 365 days)
      const daysAgo = Math.floor(Math.random() * 365);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      // Format for PostgreSQL (ISO string is fine usually)
      const invoiceDate = date.toISOString();

      newInvoices.push({
        customer_id: customer.id,
        product_id: product.id,
        category_id: product.category_id,
        quantity: quantity,
        total_amount: totalAmount,
        invoice_date: invoiceDate
      });
    }

    // 4. Insert Invoices (Batch or Transaction)
    // We'll use a transaction for safety
    const insertQueries = newInvoices.map(inv => {
      return {
        text: `INSERT INTO invoices (customer_id, product_id, category_id, quantity, total_amount, invoice_date) 
                   VALUES ($1, $2, $3, $4, $5, $6)`,
        params: [
          inv.customer_id,
          inv.product_id,
          inv.category_id,
          inv.quantity,
          inv.total_amount,
          inv.invoice_date
        ]
      };
    });

    console.log('Inserting invoices...');
    await queryTransaction(insertQueries);

    console.log('✅ Seeding completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedInvoices();

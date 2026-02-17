
const BASE_URL = 'http://127.0.0.1:3000';

async function benchmark() {
  console.log('🚀 Starting Benchmark...');

  const collection = 'customers';
  const field = 'email';
  const query = 'bob'; // Assuming 'bob' exists or something similar

  const url = `${BASE_URL}/suggestions?database=salesDB&collection=${collection}&field=${field}&query=${query}`;

  // 1. First Request (Cache Miss - Hits DB)
  const start1 = performance.now();
  await fetch(url);
  const end1 = performance.now();
  console.log(`1️⃣ First Request (DB Hit): ${(end1 - start1).toFixed(2)}ms`);

  // 2. Second Request (Cache Hit)
  const start2 = performance.now();
  await fetch(url);
  const end2 = performance.now();
  console.log(`2️⃣ Second Request (Cache Hit): ${(end2 - start2).toFixed(2)}ms`);

  // 3. Third Request (Cache Hit)
  const start3 = performance.now();
  await fetch(url);
  const end3 = performance.now();
  console.log(`3️⃣ Third Request (Cache Hit): ${(end3 - start3).toFixed(2)}ms`);

  if ((end2 - start2) < (end1 - start1)) {
    console.log('✅ Cache works! Subsequent requests are faster.');
  } else {
    console.log('⚠️ Cache might not be working as expected (or DB is too fast to notice).');
  }
}

benchmark();

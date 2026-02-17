const RELATIONS = 
[
  { 
    from: "customers", 
    to: "invoices", 
    local: "id", 
    foreign: "customer_id" 
  },
  { 
    from: "products", 
    to: "invoices", 
    local: "id", 
    foreign: "product_id" 
  },
  { 
    from: "categories", 
    to: "products", 
    local: "id", 
    foreign: "category_id" 
  },
  { 
    from: "categories", 
    to: "invoices", 
    local: "id", 
    foreign: "category_id" 
  }
];

export default RELATIONS;
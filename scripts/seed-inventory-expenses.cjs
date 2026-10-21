'use strict';

const db = require('better-sqlite3')('flo.db');
const { randomUUID, randomBytes } = require('crypto');

function run() {
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  const userId = adminUser ? adminUser.id : 'a0aa88e5-ab99-46d6-b347-1342c650d127';

  const todayStr = '2026-10-21';
  const yesterdayStr = '2026-10-20';
  const twoDaysAgoStr = '2026-10-19';
  const threeDaysAgoStr = '2026-10-18';
  const fourDaysAgoStr = '2026-10-17';

  console.log('Seeding Inventory and Expenses with actor:', userId);

  const txn = db.transaction(() => {
    // -------------------------------------------------------------
    // 1. INVENTORY: SUPPLIES
    // -------------------------------------------------------------
    const suppliesData = [
      {
        id: 'sup_chicken',
        name: 'Fresh Chicken Breast',
        base_unit: 'kg',
        stock_quantity: 28.5,
        low_stock_threshold: 10.0,
      },
      {
        id: 'sup_paneer',
        name: 'Fresh Malai Paneer',
        base_unit: 'kg',
        stock_quantity: 14.0,
        low_stock_threshold: 5.0,
      },
      {
        id: 'sup_basmati_rice',
        name: 'Premium Basmati Rice',
        base_unit: 'kg',
        stock_quantity: 45.0,
        low_stock_threshold: 15.0,
      },
      {
        id: 'sup_butter',
        name: 'Cooking Butter (Salted)',
        base_unit: 'kg',
        stock_quantity: 8.2,
        low_stock_threshold: 4.0,
      },
      {
        id: 'sup_cream',
        name: 'Fresh Dairy Cream',
        base_unit: 'l',
        stock_quantity: 12.0,
        low_stock_threshold: 3.0,
      },
      {
        id: 'sup_black_lentils',
        name: 'Urad Dal (Black Lentils)',
        base_unit: 'kg',
        stock_quantity: 22.0,
        low_stock_threshold: 8.0,
      },
      {
        id: 'sup_cooking_oil',
        name: 'Refined Sunflower Oil',
        base_unit: 'l',
        stock_quantity: 35.0,
        low_stock_threshold: 10.0,
      },
      {
        id: 'sup_lemons',
        name: 'Fresh Yellow Lemons',
        base_unit: 'each',
        stock_quantity: 85,
        low_stock_threshold: 25,
      },
      {
        id: 'sup_sugar_syrup',
        name: 'Sugar Syrup 65 Brix',
        base_unit: 'l',
        stock_quantity: 9.5,
        low_stock_threshold: 3.0,
      },
      {
        id: 'sup_soda_cans',
        name: 'Club Soda Cans 330ml',
        base_unit: 'each',
        stock_quantity: 48,
        low_stock_threshold: 20,
      },
      {
        id: 'sup_cola_cans',
        name: 'Coca Cola Cans 330ml',
        base_unit: 'each',
        stock_quantity: 36,
        low_stock_threshold: 15,
      },
      {
        id: 'sup_takeaway_boxes',
        name: 'Meal Boxes (3-Comp)',
        base_unit: 'each',
        stock_quantity: 210,
        low_stock_threshold: 50,
      },
      {
        id: 'sup_paper_bags',
        name: 'Kraft Carry Bags',
        base_unit: 'each',
        stock_quantity: 320,
        low_stock_threshold: 75,
      },
    ];

    const insertSupply = db.prepare(`
      INSERT OR REPLACE INTO supplies (id, name, base_unit, stock_quantity, low_stock_threshold, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const sup of suppliesData) {
      insertSupply.run(
        sup.id,
        sup.name,
        sup.base_unit,
        sup.stock_quantity,
        sup.low_stock_threshold,
        `${fourDaysAgoStr} 09:00:00`,
        `${todayStr} 12:00:00`,
      );
    }
    console.log(`Seeded ${suppliesData.length} supplies.`);

    // -------------------------------------------------------------
    // 2. INVENTORY: SUPPLY MOVEMENTS
    // -------------------------------------------------------------
    const movementsData = [
      {
        supply_id: 'sup_chicken',
        quantity_delta: 35.0,
        movement_type: 'receive',
        unit: 'kg',
        stock_after: 35.0,
        reason: 'Weekly poultry delivery PO-8821',
        created_at: `${threeDaysAgoStr} 08:30:00`,
      },
      {
        supply_id: 'sup_chicken',
        quantity_delta: -6.5,
        movement_type: 'adjustment',
        unit: 'kg',
        stock_after: 28.5,
        reason: 'Kitchen prep batching for Butter Chicken & Wings',
        created_at: `${yesterdayStr} 16:45:00`,
      },
      {
        supply_id: 'sup_paneer',
        quantity_delta: 20.0,
        movement_type: 'receive',
        unit: 'kg',
        stock_after: 20.0,
        reason: 'Fresh dairy crate delivery',
        created_at: `${threeDaysAgoStr} 09:15:00`,
      },
      {
        supply_id: 'sup_paneer',
        quantity_delta: -6.0,
        movement_type: 'adjustment',
        unit: 'kg',
        stock_after: 14.0,
        reason: 'Marination for Tikka platters',
        created_at: `${yesterdayStr} 17:00:00`,
      },
      {
        supply_id: 'sup_butter',
        quantity_delta: 15.0,
        movement_type: 'receive',
        unit: 'kg',
        stock_after: 15.0,
        reason: 'Dairy shipment',
        created_at: `${fourDaysAgoStr} 10:00:00`,
      },
      {
        supply_id: 'sup_butter',
        quantity_delta: -6.8,
        movement_type: 'adjustment',
        unit: 'kg',
        stock_after: 8.2,
        reason: 'Gravy base preparation',
        created_at: `${yesterdayStr} 18:30:00`,
      },
      {
        supply_id: 'sup_lemons',
        quantity_delta: 120,
        movement_type: 'receive',
        unit: 'each',
        stock_after: 120,
        reason: 'Wholesale produce market crate',
        created_at: `${fourDaysAgoStr} 07:45:00`,
      },
      {
        supply_id: 'sup_lemons',
        quantity_delta: -35,
        movement_type: 'waste',
        unit: 'each',
        stock_after: 85,
        reason: 'Bar prep juicing & spoilage triage',
        created_at: `${todayStr} 11:15:00`,
      },
      {
        supply_id: 'sup_soda_cans',
        quantity_delta: 72,
        movement_type: 'receive',
        unit: 'each',
        stock_after: 72,
        reason: 'Beverage vendor restock 3 crates',
        created_at: `${twoDaysAgoStr} 14:00:00`,
      },
      {
        supply_id: 'sup_soda_cans',
        quantity_delta: -24,
        movement_type: 'count',
        unit: 'each',
        stock_after: 48,
        reason: 'Physical bar fridge reconciliation',
        created_at: `${todayStr} 10:30:00`,
      },
    ];

    const insertMovement = db.prepare(`
      INSERT INTO supply_movements (supply_id, quantity_delta, movement_type, unit, stock_after, reason, actor_user_id, reference_type, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?)
    `);

    for (const m of movementsData) {
      insertMovement.run(
        m.supply_id,
        m.quantity_delta,
        m.movement_type,
        m.unit,
        m.stock_after,
        m.reason,
        userId,
        m.created_at,
      );
    }
    console.log(`Seeded ${movementsData.length} supply movements.`);

    // -------------------------------------------------------------
    // 3. INVENTORY: RECIPES & RECIPE ITEMS
    // -------------------------------------------------------------
    const recipesData = [
      {
        id: 'rec_butter_chicken',
        product_id: 'prod-demo-butter-chicken',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_chicken', quantity: 0.35, unit: 'kg' },
          { supply_id: 'sup_butter', quantity: 0.08, unit: 'kg' },
          { supply_id: 'sup_cream', quantity: 0.1, unit: 'l' },
        ],
      },
      {
        id: 'rec_paneer_tikka',
        product_id: 'prod-demo-paneer-tikka',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_paneer', quantity: 0.25, unit: 'kg' },
          { supply_id: 'sup_cooking_oil', quantity: 0.03, unit: 'l' },
          { supply_id: 'sup_butter', quantity: 0.03, unit: 'kg' },
        ],
      },
      {
        id: 'rec_chicken_wings',
        product_id: 'prod-demo-chicken-wings',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_chicken', quantity: 0.3, unit: 'kg' },
          { supply_id: 'sup_cooking_oil', quantity: 0.05, unit: 'l' },
        ],
      },
      {
        id: 'rec_dal_makhani',
        product_id: 'prod-demo-dal-makhani',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_black_lentils', quantity: 0.2, unit: 'kg' },
          { supply_id: 'sup_butter', quantity: 0.06, unit: 'kg' },
          { supply_id: 'sup_cream', quantity: 0.05, unit: 'l' },
        ],
      },
      {
        id: 'rec_jeera_rice',
        product_id: 'prod-demo-jeera-rice',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_basmati_rice', quantity: 0.2, unit: 'kg' },
          { supply_id: 'sup_butter', quantity: 0.02, unit: 'kg' },
        ],
      },
      {
        id: 'rec_lemon_soda',
        product_id: 'prod-demo-lemon-soda',
        yield_quantity: 1,
        items: [
          { supply_id: 'sup_lemons', quantity: 1, unit: 'each' },
          { supply_id: 'sup_soda_cans', quantity: 1, unit: 'each' },
          { supply_id: 'sup_sugar_syrup', quantity: 0.03, unit: 'l' },
        ],
      },
    ];

    const insertRecipe = db.prepare(`
      INSERT OR REPLACE INTO recipes (id, product_id, yield_quantity, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);

    const insertRecipeItem = db.prepare(`
      INSERT OR REPLACE INTO recipe_items (id, recipe_id, supply_id, quantity, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const r of recipesData) {
      insertRecipe.run(
        r.id,
        r.product_id,
        r.yield_quantity,
        `${threeDaysAgoStr} 10:00:00`,
        `${todayStr} 10:00:00`,
      );
      for (const item of r.items) {
        insertRecipeItem.run(
          `ritem_${randomBytes(8).toString('hex')}`,
          r.id,
          item.supply_id,
          item.quantity,
          item.unit,
          `${threeDaysAgoStr} 10:00:00`,
        );
      }
    }
    console.log(`Seeded ${recipesData.length} recipes and recipe items.`);

    // -------------------------------------------------------------
    // 4. EXPENSE CATEGORIES
    // -------------------------------------------------------------
    const categoriesData = [
      { id: 'cat_ingredients', name: 'Raw Ingredients & Groceries' },
      { id: 'cat_utilities', name: 'Utilities & Electricity' },
      { id: 'cat_packaging', name: 'Packaging & Disposables' },
      { id: 'cat_maintenance', name: 'Kitchen Maintenance & Repairs' },
      { id: 'cat_staff_welfare', name: 'Staff Welfare & Refreshments' },
      { id: 'cat_cleaning', name: 'Cleaning & Sanitization' },
    ];

    const insertCategory = db.prepare(`
      INSERT OR REPLACE INTO expense_categories (id, name, name_key, is_active, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
    `);

    for (const c of categoriesData) {
      insertCategory.run(
        c.id,
        c.name,
        c.name.toLowerCase(),
        userId,
        userId,
        `${fourDaysAgoStr} 08:00:00`,
        `${todayStr} 08:00:00`,
      );
    }
    console.log(`Seeded ${categoriesData.length} expense categories.`);

    // -------------------------------------------------------------
    // 5. EXPENSES & PAYMENTS
    // -------------------------------------------------------------
    const expensesData = [
      {
        id: 'exp_dairy_001',
        category_id: 'cat_ingredients',
        category_name: 'Raw Ingredients & Groceries',
        description: 'Weekly Dairy & Butter Supply',
        payee: 'Milma Dairy Cooperative',
        notes: 'Includes 15kg Butter and 20kg fresh malai paneer',
        amount_minor: 485000, // ₹4,850.00
        incurred_on: fourDaysAgoStr,
        created_at: `${fourDaysAgoStr} 11:20:00`,
        payment_method: 'bank_transfer',
        paid: true,
      },
      {
        id: 'exp_poultry_002',
        category_id: 'cat_ingredients',
        category_name: 'Raw Ingredients & Groceries',
        description: 'Fresh Poultry & Chicken Delivery',
        payee: 'Farm Fresh Broilers',
        notes: '35kg boneless chicken breast crate',
        amount_minor: 820000, // ₹8,200.00
        incurred_on: threeDaysAgoStr,
        created_at: `${threeDaysAgoStr} 09:30:00`,
        payment_method: 'bank_transfer',
        paid: true,
      },
      {
        id: 'exp_packaging_003',
        category_id: 'cat_packaging',
        category_name: 'Packaging & Disposables',
        description: 'Kraft Meal Containers & Delivery Bags',
        payee: 'EcoPack India Distributors',
        notes: 'Bulk purchase of 500 takeout boxes and branded paper bags',
        amount_minor: 560000, // ₹5,600.00
        incurred_on: twoDaysAgoStr,
        created_at: `${twoDaysAgoStr} 14:15:00`,
        payment_method: 'card',
        paid: true,
      },
      {
        id: 'exp_utilities_004',
        category_id: 'cat_utilities',
        category_name: 'Utilities & Electricity',
        description: 'Commercial Electricity Bill (October)',
        payee: 'Kerala State Electricity Board (KSEB)',
        notes: 'Consumer #2891230491',
        amount_minor: 1245000, // ₹12,450.00
        incurred_on: twoDaysAgoStr,
        created_at: `${twoDaysAgoStr} 15:45:00`,
        payment_method: 'bank_transfer',
        paid: true,
      },
      {
        id: 'exp_maintenance_005',
        category_id: 'cat_maintenance',
        category_name: 'Kitchen Maintenance & Repairs',
        description: 'Exhaust Hood Deep Clean & Chimney Service',
        payee: 'Apex Hood Cleaning Services',
        notes: 'Quarterly compliance and degreasing service',
        amount_minor: 320000, // ₹3,200.00
        incurred_on: yesterdayStr,
        created_at: `${yesterdayStr} 11:00:00`,
        payment_method: 'cash',
        paid: true,
      },
      {
        id: 'exp_cleaning_006',
        category_id: 'cat_cleaning',
        category_name: 'Cleaning & Sanitization',
        description: 'Dishwashing Liquid & Floor Disinfectant Bulk',
        payee: 'CleanCare Solutions',
        notes: '2x 25L chemical cans for kitchen stewards',
        amount_minor: 195000, // ₹1,950.00
        incurred_on: yesterdayStr,
        created_at: `${yesterdayStr} 17:10:00`,
        payment_method: 'cash',
        paid: true,
      },
      {
        id: 'exp_produce_007',
        category_id: 'cat_ingredients',
        category_name: 'Raw Ingredients & Groceries',
        description: 'Fresh Lemons, Onions & Herbs Crate',
        payee: 'Kochi Central Wholesale Produce',
        notes: 'Daily market procurement invoice #4412',
        amount_minor: 240000, // ₹2,400.00
        incurred_on: todayStr,
        created_at: `${todayStr} 08:45:00`,
        payment_method: 'cash',
        paid: true,
      },
      {
        id: 'exp_staff_008',
        category_id: 'cat_staff_welfare',
        category_name: 'Staff Welfare & Refreshments',
        description: 'Kitchen Team Evening Snacks & Tea',
        payee: 'Corner Chai & Bakers',
        notes: 'Staff shift snacks for kitchen and service team',
        amount_minor: 85000, // ₹850.00
        incurred_on: todayStr,
        created_at: `${todayStr} 17:30:00`,
        payment_method: 'cash',
        paid: true,
      },
    ];

    const insertExpense = db.prepare(`
      INSERT OR REPLACE INTO expenses (id, category_id, category_name, description, payee, notes, amount_minor, currency_code, incurred_on, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?)
    `);

    const insertPayment = db.prepare(`
      INSERT OR REPLACE INTO expense_payments (id, expense_id, amount_minor, method, business_date, created_by, created_at, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const exp of expensesData) {
      insertExpense.run(
        exp.id,
        exp.category_id,
        exp.category_name,
        exp.description,
        exp.payee,
        exp.notes,
        exp.amount_minor,
        exp.incurred_on,
        userId,
        exp.created_at,
      );

      if (exp.paid) {
        insertPayment.run(
          `pmt_${exp.id}`,
          exp.id,
          exp.amount_minor,
          exp.payment_method,
          exp.incurred_on,
          userId,
          exp.created_at,
          `REF-${randomBytes(4).toString('hex').toUpperCase()}`,
        );
      }
    }
    console.log(`Seeded ${expensesData.length} expenses and payments.`);
  });

  txn();
  console.log('Seeding completed successfully!');
}

run();

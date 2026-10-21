'use strict';
const db = require('better-sqlite3')('flo.db');

const counts = {
  supplies: db.prepare('SELECT COUNT(*) as c FROM supplies').get().c,
  supply_movements: db.prepare('SELECT COUNT(*) as c FROM supply_movements').get().c,
  recipes: db.prepare('SELECT COUNT(*) as c FROM recipes').get().c,
  recipe_items: db.prepare('SELECT COUNT(*) as c FROM recipe_items').get().c,
  expense_categories: db.prepare('SELECT COUNT(*) as c FROM expense_categories').get().c,
  expenses: db.prepare('SELECT COUNT(*) as c FROM expenses').get().c,
  expense_payments: db.prepare('SELECT COUNT(*) as c FROM expense_payments').get().c,
};

console.log('Current row counts:', counts);
if (counts.expense_categories > 0) {
  console.log('Expense categories:', db.prepare('SELECT * FROM expense_categories').all());
}
if (counts.supplies > 0) {
  console.log('Supplies:', db.prepare('SELECT * FROM supplies').all());
}

'use strict';
const db = require('better-sqlite3')('flo.db');

const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log('RELEVANT TABLES:');
tables.forEach((t) => {
  if (
    t.name.includes('suppl') ||
    t.name.includes('recip') ||
    t.name.includes('invent') ||
    t.name.includes('expens')
  ) {
    console.log('=== ' + t.name + ' ===');
    console.log(t.sql);
  }
});

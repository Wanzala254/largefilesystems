import Database from 'better-sqlite3'

// Connect to the database
const db = new Database('network-tracker.db')
db.pragma('foreign_keys = ON')

console.log('=== Network Tracker Database Tables ===\n')

// Get all table names
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()

console.log('Tables in database:')
tables.forEach(table => {
  console.log(`- ${table.name}`)
})

console.log('\n=== Data in Each Table ===\n')

// Function to show table data
function showTableData(tableName) {
  console.log(`\n--- ${tableName.toUpperCase()} ---`)
  
  try {
    // Get table structure
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
    console.log('Columns:', columns.map(col => col.name).join(', '))
    
    // Get row count
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get()
    console.log(`Total rows: ${count.count}`)
    
    // Show first few rows
    if (count.count > 0) {
      console.log('\nSample data:')
      const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all()
      sample.forEach((row, index) => {
        console.log(`${index + 1}.`, row)
      })
    }
  } catch (error) {
    console.log(`Error reading ${tableName}:`, error.message)
  }
}

// Show data from all tables
tables.forEach(table => {
  showTableData(table.name)
})

console.log('\n=== Database Connection Test ===')
try {
  const test = db.prepare('SELECT 1 as test').get()
  console.log('✅ Database connection successful')
  console.log('Test query result:', test)
} catch (error) {
  console.log('❌ Database connection failed:', error.message)
}

db.close()
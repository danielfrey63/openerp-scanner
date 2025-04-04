/**
 * Cleanup script for Vitest timestamp files
 * 
 * This script removes all timestamp-*.mjs files generated by Vitest
 * during test runs to keep the project directory clean.
 */

const fs = require('fs');
const path = require('path');

// Get the test directory path
const testDir = path.join(__dirname, '..', 'test');

console.log('Cleaning up Vitest timestamp files...');

try {
  // Read all files in the test directory
  const files = fs.readdirSync(testDir);
  
  // Filter for timestamp files
  const timestampFiles = files.filter(file => 
    file.includes('timestamp-') && file.endsWith('.mjs')
  );
  
  // Delete each timestamp file
  let deletedCount = 0;
  timestampFiles.forEach(file => {
    const filePath = path.join(testDir, file);
    fs.unlinkSync(filePath);
    deletedCount++;
  });
  
  console.log(`Successfully deleted ${deletedCount} timestamp file(s).`);
} catch (error) {
  console.error('Error cleaning up timestamp files:', error.message);
  process.exit(1);
}

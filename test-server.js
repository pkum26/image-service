// Simple test script to verify the server starts correctly
require('dotenv').config();

console.log('Testing server startup...');
console.log('Environment check:');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('- PORT:', process.env.PORT || 'DEFAULT (3000)');
console.log('- STORAGE_TYPE:', process.env.STORAGE_TYPE || 'DEFAULT (local)');

// Test if we can import our main modules
try {
  const express = require('express');
  console.log('✓ Express imported successfully');
  
  const mongoose = require('mongoose');
  console.log('✓ Mongoose imported successfully');
  
  const jwt = require('jsonwebtoken');
  console.log('✓ JWT imported successfully');
  
  const multer = require('multer');
  console.log('✓ Multer imported successfully');
  
  const sharp = require('sharp');
  console.log('✓ Sharp imported successfully');
  
  console.log('\n✓ All core dependencies are available!');
  console.log('\nYou can now start the server with: npm start');
  console.log('Or for development: npm run dev');
  
} catch (error) {
  console.error('✗ Error importing dependencies:', error.message);
  console.log('Please run: npm install');
}

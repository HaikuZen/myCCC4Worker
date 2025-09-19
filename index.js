#!/usr/bin/env node

/**
 * myCCC - Cycling Calories Calculator Web Application
 * Extracted from the full cycling-calories-calculator project
 * Contains only the web interface and database functionality
 */

const path = require('path');

// Start the web server directly
const webServerPath = path.join(__dirname, 'web', 'index-new.js');
require(webServerPath);
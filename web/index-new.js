#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const multer = require('multer');
const GPXParser = require('../lib/gpx-parser');
const DatabaseService = require('../lib/database-service');

/**
 * myCCC - Cycling Calories Calculator Web Application
 * Web-only version extracted from the full cycling-calories-calculator project
 */

// Start the web server directly
startWebServer();

async function startWebServer(port = 8000, openBrowser = false) {
    const app = express();
    const parser = new GPXParser();
    const dbService = new DatabaseService(path.join(__dirname, '..', 'cycling_data.db'));
    
    // Initialize database service
    try {
        await dbService.initialize();
        console.log('✅ Database service ready');
    } catch (error) {
        console.warn('⚠️ Database initialization failed:', error.message);
    }
    
    // Configure multer for file uploads
    const upload = multer({ 
        dest: path.join(__dirname, '..', 'uploads'),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        fileFilter: (req, file, cb) => {
            if (file.originalname.toLowerCase().endsWith('.gpx')) {
                cb(null, true);
            } else {
                cb(new Error('Only GPX files are allowed'));
            }
        }
    });
    
    // Serve static files from web directory
    app.use(express.static(__dirname));
    app.use(express.json());
    
    // Routes
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
    
    // Add debugging middleware for upload
    app.use('/upload', (req, res, next) => {
        console.log('🚀 Upload middleware - Raw request details:');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);
        console.log('Method:', req.method);
        console.log('URL:', req.url);
        console.log('Body before multer:', req.body);
        next();
    });

    // GPX Upload endpoint with error handling
    app.post('/upload', (req, res, next) => {
        upload.single('gpxFile')(req, res, function (err) {
            if (err) {
                console.error('😁 Multer error:', err);
                if (err instanceof multer.MulterError) {
                    console.error('Multer error code:', err.code);
                    console.error('Multer error field:', err.field);
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`
                });
            }
            next();
        });
    }, async (req, res) => {
        console.log('🚀 Upload request received after multer');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request file:', req.file ? req.file.originalname : 'No file');
        console.log('Request files object:', req.files);
        console.log('Request headers:', req.headers['content-type']);
        console.log('Accept header:', req.headers['accept']);
        
        // Determine if this is an HTMX request or regular AJAX
        const isHTMX = req.headers['hx-request'] === 'true';
        const wantsJSON = req.headers['accept']?.includes('application/json');
        
        try {
            if (!req.file) {
                console.error('❌ No file in request');
                
                if (wantsJSON && !isHTMX) {
                    return res.status(400).json({
                        success: false,
                        message: 'No file uploaded or invalid file type'
                    });
                } else {
                    return res.status(400).send(`
                        <div class="alert alert-error">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <span>No file uploaded or invalid file type</span>
                        </div>
                    `);
                }
            }

            const fileName = req.file.originalname;
            console.log(`🔍 Checking for duplicate: ${fileName}`);
            
            // First do a quick filename check
            const quickDuplicateCheck = await dbService.checkDuplicateByFilename(fileName);
            if (quickDuplicateCheck) {
                console.log('❌ Duplicate file detected by filename:', fileName);
                
                // Clean up uploaded file
                try {
                    await fs.unlink(req.file.path);
                } catch (err) {
                    console.error('Error deleting duplicate file:', err);
                }
                
                const errorMessage = `File "${fileName}" already exists in the database (uploaded on ${new Date(quickDuplicateCheck.ride_date).toLocaleDateString('en-GB')}).`;
                
                if (wantsJSON && !isHTMX) {
                    return res.status(409).json({
                        success: false,
                        message: errorMessage,
                        duplicate: true
                    });
                } else {
                    return res.status(409).send(`
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <span>${errorMessage}</span>
                        </div>
                    `);
                }
            }
            
            // Parse the GPX file
            console.log('📋 Parsing GPX file:', fileName);
            const data = await parser.parse(req.file.path);
            console.log('✅ GPX file parsed successfully:\n summary: '+JSON.stringify(data.summary));
            const fileSize = (req.file.size / 1024).toFixed(1);
            
            // Do a more thorough content-based duplicate check
            console.log('🔍 Checking for content-based duplicates...');
            // Transform GPXParser output to expected format for duplicate checking
            const gpxDataForCheck = {
                distance: data.summary.distance,
                duration: data.summary.totalTime / 60, // Convert seconds to minutes
                startTime: data.summary.startTime
            };
            const duplicateCheck = await dbService.checkForDuplicate(fileName, gpxDataForCheck);
            
            if (duplicateCheck.isDuplicate) {
                console.log(`❌ Duplicate content detected: ${duplicateCheck.type}`);
                
                // Clean up uploaded file
                try {
                    await fs.unlink(req.file.path);
                } catch (err) {
                    console.error('Error deleting duplicate file:', err);
                }
                
                if (wantsJSON && !isHTMX) {
                    return res.status(409).json({
                        success: false,
                        message: duplicateCheck.message,
                        duplicate: true,
                        duplicateType: duplicateCheck.type
                    });
                } else {
                    return res.status(409).send(`
                        <div class="alert alert-warning">
                            <i class="fas fa-copy mr-2"></i>
                            <div>
                                <div class="font-medium">Duplicate Content Detected</div>
                                <div class="text-sm">${duplicateCheck.message}</div>
                            </div>
                        </div>
                    `);
                }
            }
            
            console.log('✅ No duplicates found, processing upload...');
            
            // Save to database if available
            try {
                await dbService.saveGPXAnalysis(data, fileName);
                console.log('✅ GPX analysis saved to database');
            } catch (dbError) {
                console.warn('⚠️ Failed to save to database:', dbError.message);
            }
            
            // Clean up uploaded file
            setTimeout(async () => {
                try {
                    await fs.unlink(req.file.path);
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            }, 5000);

            res.send(generateUploadResponse(data, fileName, fileSize));
            
        } catch (error) {
            console.error('Upload error:', error);
            
            if (wantsJSON && !isHTMX) {
                res.status(500).json({
                    success: false,
                    message: `Error processing file: ${error.message}`
                });
            } else {
                res.status(500).send(`
                    <div class="alert alert-error">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <span>Error processing file: ${error.message}</span>
                    </div>
                `);
            }
        }
    });
    
    // Data filtering endpoint
    app.get('/filter-data', async (req, res) => {
        const { startDate, endDate } = req.query;
        console.log('🔍 Filtering data from', startDate, 'to', endDate);
        if (!startDate || !endDate) {
            return res.status(400).send(`
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>Please select both start and end dates</span>
                </div>
            `);
        }
        
        try {
            const filteredData = await dbService.getRidesInDateRange(startDate, endDate);
            res.send(generateFilteredDataFromDB(filteredData, startDate, endDate));
        } catch (error) {
            console.error('Error filtering data:', error.message);
            // Fallback to mock data
            const mockData = generateFilteredData(startDate, endDate);
            res.send(mockData);
        }
    });
    
    // API endpoint for dashboard statistics
    app.get('/api/dashboard', async (req, res) => {
        try {
            const globalStats = await dbService.getGlobalStatistics();
            const recentRides = await dbService.getRecentRides(5);
            const chartData = await dbService.getChartData(365);
            const monthlyData = await dbService.getMonthlySummary();
            const trends = await dbService.getPerformanceTrends();
            
            res.json({
                statistics: globalStats,
                recentRides,
                chartData,
                monthlyData,
                trends
            });
        } catch (error) {
            console.error('Error getting dashboard data:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    // API endpoint for recent rides
    app.get('/api/rides', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const rides = await dbService.getRecentRides(limit);
            res.json(rides);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // API endpoint for chart data
    app.get('/api/chart-data', async (req, res) => {
        try {            
            const chartData = await dbService.getChartData(req.query.startDate, req.query.endDate);
            res.json(chartData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // API endpoint for CLI integration
    app.post('/api/analyze', upload.single('gpxFile'), async (req, res) => {
        try {
            const data = await parser.parse(req.file.path);
            
            // Save to database
            try {
                await dbService.saveGPXAnalysis(data, req.file.originalname);
            } catch (dbError) {
                console.warn('Failed to save to database:', dbError.message);
            }
            
            res.json(data);
            
            // Clean up
            await fs.unlink(req.file.path);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Database management routes
    app.get('/database', (req, res) => {
        res.sendFile(path.join(__dirname, 'database.html'));
    });
    
    // Database API endpoints
    app.get('/api/database/overview', async (req, res) => {
        try {
            const stats = await dbService.getGlobalStatistics();
            const dbPath = path.join(__dirname, '..', 'cycling_data.db');
            let fileStats;
            
            try {
                fileStats = await fs.stat(dbPath);
            } catch (err) {
                fileStats = { size: 0, mtime: new Date() };
            }
            
            res.json({
                totalRides: stats.totalRides || 0,
                databaseSize: fileStats.size,
                lastModified: fileStats.mtime.toLocaleDateString('en-GB')
            });
        } catch (error) {
            console.error('Error getting database overview:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/api/database/table/:tableName', async (req, res) => {
        try {
            const { tableName } = req.params;
            const validTables = ['rides', 'calorie_breakdown', 'configuration'];
            
            if (!validTables.includes(tableName)) {
                return res.status(400).json({ error: 'Invalid table name' });
            }
            
            const data = await dbService.getTableData(tableName);
            res.json(data);
        } catch (error) {
            console.error('Error getting table data:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.put('/api/database/table/:tableName/:recordId', async (req, res) => {
        try {
            const { tableName, recordId } = req.params;
            const updateData = req.body;
            
            const result = await dbService.updateRecord(tableName, recordId, updateData);
            res.json({ success: true, changes: result.changes });
        } catch (error) {
            console.error('Error updating record:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.delete('/api/database/table/:tableName/:recordId', async (req, res) => {
        try {
            const { tableName, recordId } = req.params;
            
            const result = await dbService.deleteRecord(tableName, recordId);
            res.json({ success: true, changes: result.changes });
        } catch (error) {
            console.error('Error deleting record:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/database/query', async (req, res) => {
        try {
            const { query } = req.body;
            
            if (!query) {
                return res.status(400).json({ error: 'Query is required' });
            }
            
            // Basic safety check - prevent certain dangerous operations
            const lowerQuery = query.toLowerCase().trim();
            if (lowerQuery.includes('drop table') || lowerQuery.includes('drop database')) {
                return res.status(400).json({ error: 'DROP operations are not allowed' });
            }
            
            const result = await dbService.executeQuery(query);
            res.json(result);
        } catch (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/api/database/export/:tableName', async (req, res) => {
        try {
            const { tableName } = req.params;
            const csv = await dbService.exportTableToCsv(tableName);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export.csv"`);
            res.send(csv);
        } catch (error) {
            console.error('Error exporting table:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/database/cleanup', async (req, res) => {
        try {
            const result = await dbService.cleanupOrphanedRecords();
            res.json({ deletedRecords: result.changes || 0 });
        } catch (error) {
            console.error('Error during cleanup:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/database/optimize', async (req, res) => {
        try {
            await dbService.optimizeDatabase();
            res.json({ success: true, message: 'Database optimized successfully' });
        } catch (error) {
            console.error('Error optimizing database:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/database/backup', async (req, res) => {
        try {
            const backupPath = await dbService.createBackup();
            res.download(backupPath, path.basename(backupPath));
        } catch (error) {
            console.error('Error creating backup:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/api/database/info', async (req, res) => {
        try {
            const info = await dbService.getDatabaseInfo();
            res.json(info);
        } catch (error) {
            console.error('Error getting database info:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Check for potential duplicates endpoint
    app.post('/api/check-duplicate', async (req, res) => {
        try {
            const { filename } = req.body;
            
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }
            
            const duplicate = await dbService.checkDuplicateByFilename(filename);
            res.json({
                isDuplicate: !!duplicate,
                existing: duplicate || null
            });
        } catch (error) {
            console.error('Error checking duplicate:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Test upload endpoint for debugging
    app.post('/test-upload', upload.single('gpxFile'), (req, res) => {
        console.log('🧪 Test upload endpoint hit');
        console.log('File received:', req.file);
        console.log('Body:', req.body);
        
        if (req.file) {
            res.json({
                success: true,
                message: 'File received successfully',
                file: {
                    originalname: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'No file received'
            });
        }
    });
    
    // Configuration API endpoints
    app.get('/api/configuration', async (req, res) => {
        try {
            const config = await dbService.getAllConfiguration();
            res.json(config);
        } catch (error) {
            console.error('Error getting configuration:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.put('/api/configuration/:key', async (req, res) => {
        try {
            const { key } = req.params;
            const { value, value_type } = req.body;
            
            if (!value && value !== false && value !== 0) {
                return res.status(400).json({ error: 'Value is required' });
            }
            
            const result = await dbService.updateConfiguration(key, value, value_type);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Configuration key not found' });
            }
            
            res.json({ success: true, message: 'Configuration updated successfully' });
        } catch (error) {
            console.error('Error updating configuration:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/configuration', async (req, res) => {
        try {
            const { key, value, value_type, description, category } = req.body;
            
            if (!key || (!value && value !== false && value !== 0)) {
                return res.status(400).json({ error: 'Key and value are required' });
            }
            
            await dbService.addConfiguration(key, value, value_type || 'string', description || '', category || 'general');
            res.json({ success: true, message: 'Configuration added successfully' });
        } catch (error) {
            console.error('Error adding configuration:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.delete('/api/configuration/:key', async (req, res) => {
        try {
            const { key } = req.params;
            const result = await dbService.deleteConfiguration(key);
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Configuration key not found' });
            }
            
            res.json({ success: true, message: 'Configuration deleted successfully' });
        } catch (error) {
            console.error('Error deleting configuration:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Error handling
    app.use((error, req, res, next) => {
        console.error('❌ Server error occurred:', error);
        
        if (error instanceof multer.MulterError) {
            console.error('❌ Multer error:', error.code, error.message);
            
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).send(`
                    <div class="alert alert-error">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <span>File too large. Maximum size is 10MB.</span>
                    </div>
                `);
            }
            
            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).send(`
                    <div class="alert alert-error">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <span>Unexpected file field. Please use 'gpxFile' field name.</span>
                    </div>
                `);
            }
            
            // Other multer errors
            return res.status(400).send(`
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span>File upload error: ${error.message}</span>
                </div>
            `);
        }
        
        // Generic server error
        res.status(500).send(`
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>Server error: ${error.message}</span>
            </div>
        `);
    });
    
    // Create uploads directory if it doesn't exist
    try {
        await fs.mkdir(path.join(__dirname, '..', 'uploads'), { recursive: true });
    } catch (err) {
        // Directory already exists
    }
    
    // Cleanup on server shutdown
    process.on('SIGINT', async () => {
        console.log('\n📊 Shutting down server...');
        await dbService.close();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n📊 Shutting down server...');
        await dbService.close();
        process.exit(0);
    });
    
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`🚴‍♂️ myCCC - Cycling Calories Calculator Web Interface`);
            console.log(`📡 Server running on http://localhost:${port}`);
            console.log(`📁 Upload directory ready`);
            console.log(`🎯 Ready to analyze GPX files!\n`);
            
            if (openBrowser) {
                const { exec } = require('child_process');
                const url = `http://localhost:${port}`;
                const start = process.platform === 'darwin' ? 'open' :
                             process.platform === 'win32' ? 'start' : 'xdg-open';
                exec(`${start} ${url}`);
                console.log(`🌐 Opening ${url} in your browser...`);
            }
            resolve(server);
        }).on('error', reject);
    });
}

function generateUploadResponse(data, fileName, fileSize) {
    const summary = data.summary;
    const calories = data.analysis.caloriesBurned.estimated;
    
    return `
        <div class="alert alert-success mb-4">
            <i class="fas fa-check-circle mr-2"></i>
            <span>GPX file "${fileName}" (${fileSize}KB) processed successfully!</span>
        </div>
        
        <div class="stats stats-vertical lg:stats-horizontal shadow">
            <div class="stat bg-primary/10">
                <div class="stat-figure text-primary">
                    <i class="fas fa-route text-2xl"></i>
                </div>
                <div class="stat-title">Distance</div>
                <div class="stat-value text-primary">${summary.distance.toFixed(1)} km</div>
                <div class="stat-desc">Total distance covered</div>
            </div>
            
            <div class="stat bg-secondary/10">
                <div class="stat-figure text-secondary">
                    <i class="fas fa-fire text-2xl"></i>
                </div>
                <div class="stat-title">Calories</div>
                <div class="stat-value text-secondary">${calories}</div>
                <div class="stat-desc">Estimated calories burned</div>
            </div>
            
            <div class="stat bg-accent/10">
                <div class="stat-figure text-accent">
                    <i class="fas fa-clock text-2xl"></i>
                </div>
                <div class="stat-title">Duration</div>
                <div class="stat-value text-accent">${formatTime(summary.totalTime)}</div>
                <div class="stat-desc">Total riding time</div>
            </div>
            
            <div class="stat bg-info/10">
                <div class="stat-figure text-info">
                    <i class="fas fa-tachometer-alt text-2xl"></i>
                </div>
                <div class="stat-title">Avg Speed</div>
                <div class="stat-value text-info">${summary.avgSpeed.toFixed(1)} km/h</div>
                <div class="stat-desc">Average speed</div>
            </div>
        </div>
        
        <div class="mt-4 p-4 bg-base-200 rounded-lg">
            <h4 class="font-semibold mb-2">📍 Route Details</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="font-medium">Max Elevation:</span> ${summary.maxElevation ? summary.maxElevation.toFixed(0) + 'm' : 'N/A'}
                </div>
                <div>
                    <span class="font-medium">Elevation Gain:</span> ${summary.elevationGain.toFixed(0)}m
                </div>
                <div>
                    <span class="font-medium">Max Speed:</span> ${summary.maxSpeed.toFixed(1)} km/h
                </div>
                <div>
                    <span class="font-medium">Moving Time:</span> ${formatTime(summary.movingTime)}
                </div>
            </div>
            
            ${data.analysis.caloriesBurned.method !== 'distance_elevation' ? `
                <div class="mt-3 text-xs text-base-content/70">
                    💡 Calories calculated using ${data.analysis.caloriesBurned.method.replace('_', ' ')} method
                </div>
            ` : ''}
        </div>
    `;
}

function generateFilteredData(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const totalCalories = Math.floor(Math.random() * daysDiff * 500 + daysDiff * 200);
    const totalDistance = Math.floor(Math.random() * daysDiff * 30 + daysDiff * 10);
    const totalTime = (Math.random() * daysDiff * 2 + daysDiff * 0.5).toFixed(1);
    const avgSpeed = (totalDistance / parseFloat(totalTime)).toFixed(1);
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="stat bg-primary/10 rounded-lg">
                <div class="stat-figure text-primary">
                    <i class="fas fa-fire text-2xl"></i>
                </div>
                <div class="stat-title">Total Calories</div>
                <div class="stat-value text-primary">${totalCalories.toLocaleString()}</div>
                <div class="stat-desc">Burned in ${daysDiff} days</div>
            </div>
            
            <div class="stat bg-secondary/10 rounded-lg">
                <div class="stat-figure text-secondary">
                    <i class="fas fa-route text-2xl"></i>
                </div>
                <div class="stat-title">Total Distance</div>
                <div class="stat-value text-secondary">${totalDistance} km</div>
                <div class="stat-desc">Kilometers covered</div>
            </div>
            
            <div class="stat bg-accent/10 rounded-lg">
                <div class="stat-figure text-accent">
                    <i class="fas fa-clock text-2xl"></i>
                </div>
                <div class="stat-title">Total Time</div>
                <div class="stat-value text-accent">${totalTime}h</div>
                <div class="stat-desc">Hours of cycling</div>
            </div>
            
            <div class="stat bg-info/10 rounded-lg">
                <div class="stat-figure text-info">
                    <i class="fas fa-tachometer-alt text-2xl"></i>
                </div>
                <div class="stat-title">Avg Speed</div>
                <div class="stat-value text-info">${avgSpeed}</div>
                <div class="stat-desc">km/h average</div>
            </div>
        </div>

        <div class="alert alert-info mb-6">
            <i class="fas fa-info-circle mr-2"></i>
            <span>Showing data from ${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')} (${daysDiff} days)</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Calories Burned Over Time</h3>
                    <div class="chart-container">
                        <canvas id="caloriesChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Distance Covered</h3>
                    <div class="chart-container">
                        <canvas id="distanceChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Speed Analysis</h3>
                    <div class="chart-container">
                        <canvas id="speedChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Elevation Profile</h3>
                    <div class="chart-container">
                        <canvas id="elevationChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            setTimeout(() => {
                if (typeof loadSampleChartData === 'function') {
                    loadSampleChartData();
                }
            }, 100);
        </script>
    `;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function generateFilteredDataFromDB(filteredData, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const { summary } = filteredData;
    
    if (!summary || filteredData.rides.length === 0) {
        return `
            <div class="alert alert-info mb-6">
                <i class="fas fa-info-circle mr-2"></i>
                <span>No rides found from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</span>
            </div>
            
            <div class="text-center py-8">
                <i class="fas fa-bicycle text-6xl text-base-content/30 mb-4"></i>
                <p class="text-lg text-base-content/70">No cycling data available for the selected period</p>
                <p class="text-sm text-base-content/50">Upload some GPX files to see your progress!</p>
            </div>
        `;
    }
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="stat bg-primary/10 rounded-lg">
                <div class="stat-figure text-primary">
                    <i class="fas fa-fire text-2xl"></i>
                </div>
                <div class="stat-title">Total Calories</div>
                <div class="stat-value text-primary">${parseInt(summary.totalCalories).toLocaleString()}</div>
                <div class="stat-desc">Burned in ${summary.count} ride${summary.count > 1 ? 's' : ''}</div>
            </div>
            
            <div class="stat bg-secondary/10 rounded-lg">
                <div class="stat-figure text-secondary">
                    <i class="fas fa-route text-2xl"></i>
                </div>
                <div class="stat-title">Total Distance</div>
                <div class="stat-value text-secondary">${summary.totalDistance} km</div>
                <div class="stat-desc">Kilometers covered</div>
            </div>
            
            <div class="stat bg-accent/10 rounded-lg">
                <div class="stat-figure text-accent">
                    <i class="fas fa-clock text-2xl"></i>
                </div>
                <div class="stat-title">Total Time</div>
                <div class="stat-value text-accent">${summary.totalTime}</div>
                <div class="stat-desc">Hours of cycling</div>
            </div>
            
            <div class="stat bg-info/10 rounded-lg">
                <div class="stat-figure text-info">
                    <i class="fas fa-tachometer-alt text-2xl"></i>
                </div>
                <div class="stat-title">Avg Speed</div>
                <div class="stat-value text-info">${summary.avgSpeed} km/h</div>
                <div class="stat-desc">Average speed</div>
            </div>
        </div>

        <div class="alert alert-success mb-6">
            <i class="fas fa-check-circle mr-2"></i>
            <span>Found ${summary.count} ride${summary.count > 1 ? 's' : ''} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</span>
        </div>
        
        <!-- Recent Rides List -->
        <div class="card bg-base-50 mb-6">
            <div class="card-body">
                <h3 class="card-title mb-4">Rides in Selected Period</h3>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Distance</th>
                                <th>Duration</th>
                                <th>Calories</th>
                                <th>Avg Speed</th>
                                <th>Elevation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredData.rides.slice(0, 10).map(ride => `
                                <tr>
                                    <td>${ride.date}</td>
                                    <td>${ride.distance} km</td>
                                    <td>${ride.duration}</td>
                                    <td>${ride.calories} cal</td>
                                    <td>${ride.avgSpeed} km/h</td>
                                    <td>${ride.elevationGain} m</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${filteredData.rides.length > 10 ? `
                    <div class="text-center mt-4">
                        <span class="text-sm text-base-content/70">Showing 10 of ${filteredData.rides.length} rides</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Calories Burned Over Time</h3>
                    <div class="chart-container">
                        <canvas id="caloriesChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Distance Covered</h3>
                    <div class="chart-container">
                        <canvas id="distanceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            setTimeout(() => {
                if (typeof loadDatabaseChartData === 'function') {
                    // Load real data from database
                    fetch('/api/chart-data?startDate=${startDate}&endDate=${endDate}')
                        .then(response => response.json())
                        .then(data => loadDatabaseChartData(data))
                        .catch(() => {
                            // Fallback to sample data
                            if (typeof loadSampleChartData === 'function') {
                                loadSampleChartData();
                            }
                        });
                } else if (typeof loadSampleChartData === 'function') {
                    loadSampleChartData();
                }
            }, 100);
        </script>
    `;
}

// Export for use as module
module.exports = startWebServer;

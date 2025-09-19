const CyclingDatabase = require('../database');
const path = require('path');

/**
 * Database Service for Web Application
 * Provides methods to retrieve and format data for web interface
 */
class DatabaseService {
    constructor(dbPath = './cycling_data.db') {
        this.database = new CyclingDatabase(dbPath);
        this.isInitialized = false;
    }

    /**
     * Initialize the database connection
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            await this.database.initialize();
            this.isInitialized = true;
            console.log('📊 Database service initialized');
        } catch (error) {
            console.error('Failed to initialize database service:', error.message);
            throw error;
        }
    }

    /**
     * Get global statistics for the dashboard
     */
    async getGlobalStatistics() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const stats = await this.database.getRideStatistics();
            
            if (!stats || stats.total_rides === 0) {
                return {
                    hasData: false,
                    totalRides: 0,
                    totalDistance: 0,
                    totalCalories: 0,
                    totalTime: 0,
                    avgSpeed: 0,
                    totalElevation: 0,
                    avgCaloriesPerKm: 0,
                    firstRide: null,
                    lastRide: null
                };
            }

            return {
                hasData: true,
                totalRides: stats.total_rides,
                totalDistance: parseFloat(stats.total_distance || 0).toFixed(1),
                totalCalories: Math.round(stats.total_calories || 0),
                totalTime: this.formatTotalTime(stats.total_duration || 0),
                avgSpeed: parseFloat(stats.avg_speed || 0).toFixed(1),
                totalElevation: Math.round(stats.total_elevation_gain || 0),
                avgCaloriesPerKm: Math.round(stats.avg_calories_per_km || 0),
                firstRide: stats.first_ride ? new Date(stats.first_ride).toLocaleDateString('en-GB') : null,
                lastRide: stats.last_ride ? new Date(stats.last_ride).toLocaleDateString('en-GB') : null
            };
        } catch (error) {
            console.error('Error getting global statistics:', error.message);
            return { hasData: false, error: error.message };
        }
    }

    /**
     * Get recent rides for display
     */
    async getRecentRides(limit = 10) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const rides = await this.database.getAllRides(limit);
            
            return rides.map(ride => ({
                id: ride.id,
                filename: ride.gpx_filename || 'Unknown',
                date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
                distance: parseFloat(ride.distance || 0).toFixed(1),
                calories: Math.round(ride.total_calories || 0),
                duration: this.formatDuration(ride.duration || 0),
                avgSpeed: parseFloat(ride.average_speed || 0).toFixed(1),
                elevationGain: Math.round(ride.elevation_gain || 0)
            }));
        } catch (error) {
            console.error('Error getting recent rides:', error.message);
            return [];
        }
    }

    /**
     * Get rides within date range
     */
    async getRidesInDateRange(startDate, endDate, limit = null) {
        if (!this.isInitialized) await this.initialize();
        console.log(`getRidesInDateRange Fetching rides from ${startDate} to ${endDate} with limit: ${limit}`);
        try {
            const rides = await this.database.getRidesByDateRange(
                new Date(startDate), 
                new Date(endDate), 
                limit
            );
            
            const totalDistance = rides.reduce((sum, ride) => sum + (ride.distance || 0), 0);
            const totalCalories = rides.reduce((sum, ride) => sum + (ride.total_calories || 0), 0);
            const totalDuration = rides.reduce((sum, ride) => sum + (ride.duration || 0), 0);
            const avgSpeed = rides.length > 0 ? rides.reduce((sum, ride) => sum + (ride.average_speed || 0), 0) / rides.length : 0;
            const totalElevation = rides.reduce((sum, ride) => sum + (ride.elevation_gain || 0), 0);

            return {
                rides: rides.map(ride => ({
                    id: ride.id,
                    filename: ride.gpx_filename || 'Unknown',
                    date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
                    distance: parseFloat(ride.distance || 0).toFixed(1),
                    calories: Math.round(ride.total_calories || 0),
                    duration: this.formatDuration(ride.duration || 0),
                    avgSpeed: parseFloat(ride.average_speed || 0).toFixed(1),
                    elevationGain: Math.round(ride.elevation_gain || 0)
                })),
                summary: {
                    count: rides.length,
                    totalDistance: parseFloat(totalDistance).toFixed(1),
                    totalCalories: Math.round(totalCalories),
                    totalTime: this.formatTotalTime(totalDuration),
                    avgSpeed: parseFloat(avgSpeed).toFixed(1),
                    totalElevation: Math.round(totalElevation)
                }
            };
        } catch (error) {
            console.error('Error getting rides in date range:', error.message);
            return { rides: [], summary: null, error: error.message };
        }
    }

    /**
     * Get chart data for visualization
     */
    async getChartData(_startDate='1999-01-01', _endDate='2999-12-31') {
        if (!this.isInitialized) await this.initialize();        
        try {
            const endDate = new Date(_endDate);
            const startDate = new Date(_startDate);
            
            const rides = await this.database.getRidesByDateRange(startDate, endDate);
            
            // Group rides by date
            const dateGroups = {};
            rides.forEach(ride => {
                const dateKey = ride.ride_date ? new Date(ride.ride_date).toDateString() : 'Unknown';
                if (!dateGroups[dateKey]) {
                    dateGroups[dateKey] = {
                        date: dateKey,
                        distance: 0,
                        calories: 0,
                        rides: 0,
                        avgSpeed: 0,
                        elevation: 0
                    };
                }
                dateGroups[dateKey].distance += ride.distance || 0;
                dateGroups[dateKey].calories += ride.total_calories || 0;
                dateGroups[dateKey].rides += 1;
                dateGroups[dateKey].avgSpeed += ride.average_speed || 0;
                dateGroups[dateKey].elevation += ride.elevation_gain || 0;
            });

            // Calculate averages and format data
            const chartData = Object.values(dateGroups).map(group => ({
                date: group.date,
                distance: parseFloat(group.distance.toFixed(1)),
                calories: Math.round(group.calories),
                rides: group.rides,
                avgSpeed: parseFloat((group.avgSpeed / group.rides).toFixed(1)),
                elevation: Math.round(group.elevation)
            }));

            // Sort by date
            chartData.sort((a, b) => new Date(a.date) - new Date(b.date));

            return chartData;
        } catch (error) {
            console.error('Error getting chart data:', error.message);
            return [];
        }
    }

    /**
     * Get monthly summary data
     */
    async getMonthlySummary() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            // Get rides from the last 12 months
            const endDate = new Date();
            const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
            console.log(`getMonthlySummary Fetching rides from ${startDate.toISOString()} to ${endDate.toISOString()}`);
            const rides = await this.database.getRidesByDateRange(startDate, endDate);
            
            // Group by month
            const monthGroups = {};
            rides.forEach(ride => {
                if (ride.ride_date) {
                    const date = new Date(ride.ride_date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!monthGroups[monthKey]) {
                        monthGroups[monthKey] = {
                            month: monthKey,
                            distance: 0,
                            calories: 0,
                            rides: 0,
                            elevation: 0
                        };
                    }
                    
                    monthGroups[monthKey].distance += ride.distance || 0;
                    monthGroups[monthKey].calories += ride.total_calories || 0;
                    monthGroups[monthKey].rides += 1;
                    monthGroups[monthKey].elevation += ride.elevation_gain || 0;
                }
            });

            return Object.values(monthGroups).map(month => ({
                month: month.month,
                distance: parseFloat(month.distance.toFixed(1)),
                calories: Math.round(month.calories),
                rides: month.rides,
                elevation: Math.round(month.elevation)
            })).sort((a, b) => a.month.localeCompare(b.month));
        } catch (error) {
            console.error('Error getting monthly summary:', error.message);
            return [];
        }
    }

    /**
     * Get performance trends
     */
    async getPerformanceTrends(days = 90) {
        if (!this.isInitialized) await this.initialize();
        console.log('Calculating performance trends over the last', days, 'days');
        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
            
            const rides = await this.database.getRidesByDateRange(startDate, endDate);
            
            if (rides.length === 0) return null;

            // Calculate trends
            const halfPoint = Math.floor(rides.length / 2);
            const firstHalf = rides.slice(0, halfPoint);
            const secondHalf = rides.slice(halfPoint);

            const getAverage = (rides, field) => {
                const sum = rides.reduce((acc, ride) => acc + (ride[field] || 0), 0);
                return rides.length > 0 ? sum / rides.length : 0;
            };

            const trends = {
                speed: {
                    first: getAverage(firstHalf, 'average_speed'),
                    second: getAverage(secondHalf, 'average_speed'),
                    change: 0
                },
                caloriesPerKm: {
                    first: firstHalf.reduce((sum, r) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (firstHalf.length || 1),
                    second: secondHalf.reduce((sum, r) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (secondHalf.length || 1),
                    change: 0
                },
                distance: {
                    first: getAverage(firstHalf, 'distance'),
                    second: getAverage(secondHalf, 'distance'),
                    change: 0
                }
            };

            // Calculate percentage changes
            Object.keys(trends).forEach(key => {
                const trend = trends[key];
                if (trend.first > 0) {
                    trend.change = ((trend.second - trend.first) / trend.first) * 100;
                }
            });

            return trends;
        } catch (error) {
            console.error('Error getting performance trends:', error.message);
            return null;
        }
    }

    /**
     * Save analyzed GPX data to database
     */
    async saveGPXAnalysis(analysisData, gpxFilename, riderWeight = 70) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            // Transform the GPX parser output to match the expected database format
            const result = {
                summary: {
                    totalCalories: analysisData.analysis.caloriesBurned.estimated,
                    baseCalories: analysisData.analysis.caloriesBurned.breakdown.base || 0,
                    elevationCalories: analysisData.analysis.caloriesBurned.breakdown.elevation || 0,
                    windAdjustment: 0, // Not available in current GPX parser
                    environmentalAdjustment: 0, // Not available
                    baseMET: 0, // Not available
                    caloriesPerKm: Math.round(analysisData.analysis.caloriesBurned.estimated / analysisData.summary.distance),
                    caloriesPerHour: Math.round(analysisData.analysis.caloriesBurned.estimated / (analysisData.summary.totalTime / 3600))
                },
                gpxData: {
                    distance: analysisData.summary.distance,
                    duration: analysisData.summary.totalTime / 60, // Convert to minutes
                    elevationGain: analysisData.summary.elevationGain,
                    averageSpeed: analysisData.summary.avgSpeed,
                    startTime: analysisData.summary.startTime,
                    elevationEnhanced: false,
                    hasElevation: analysisData.summary.elevationGain > 0
                },
                location: {
                    lat: analysisData.points[0]?.lat || 0,
                    lon: analysisData.points[0]?.lon || 0
                },
                weatherData: {
                    windSpeed: 0,
                    windDirection: 0,
                    humidity: 50,
                    temperature: 20,
                    pressure: 1013,
                    source: 'default'
                },
                breakdown: [
                    {
                        factor: 'Base Activity',
                        calories: analysisData.analysis.caloriesBurned.breakdown.base || 0,
                        percentage: 70,
                        description: 'Base cycling activity'
                    },
                    {
                        factor: 'Elevation Gain',
                        calories: analysisData.analysis.caloriesBurned.breakdown.elevation || 0,
                        percentage: 30,
                        description: 'Additional energy for climbing'
                    }
                ]
            };

            const rideId = await this.database.saveRide(result, gpxFilename, riderWeight);
            console.log(`💾 Saved ride analysis to database with ID: ${rideId}`);
            return rideId;
        } catch (error) {
            console.error('Error saving GPX analysis:', error.message);
            throw error;
        }
    }

    /**
     * Get all configuration settings
     */
    async getAllConfiguration() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            return await this.database.getAllConfiguration();
        } catch (error) {
            console.error('Error getting all configuration:', error.message);
            throw error;
        }
    }

    /**
     * Update a configuration setting
     */
    async updateConfiguration(key, value, valueType) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            return await this.database.updateConfiguration(key, value, valueType);
        } catch (error) {
            console.error('Error updating configuration:', error.message);
            throw error;
        }
    }

    /**
     * Add a new configuration setting
     */
    async addConfiguration(key, value, valueType, description, category) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            return await this.database.addConfiguration(key, value, valueType, description, category);
        } catch (error) {
            console.error('Error adding configuration:', error.message);
            throw error;
        }
    }

    /**
     * Delete a configuration setting
     */
    async deleteConfiguration(key) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            return await this.database.deleteConfiguration(key);
        } catch (error) {
            console.error('Error deleting configuration:', error.message);
            throw error;
        }
    }

    /**
     * Get table data for database management
     */
    async getTableData(tableName) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const query = `SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`;
            const rows = await new Promise((resolve, reject) => {
                this.database.db.all(query, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            // Get column information
            const columns = await new Promise((resolve, reject) => {
                this.database.db.all(`PRAGMA table_info(${tableName})`, [], (err, info) => {
                    if (err) reject(err);
                    else resolve(info.map(col => col.name));
                });
            });
            
            return { rows, columns };
        } catch (error) {
            console.error('Error getting table data:', error.message);
            throw error;
        }
    }
    
    /**
     * Update a record in a table
     */
    async updateRecord(tableName, recordId, updateData) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            // Build update query
            const columns = Object.keys(updateData).filter(key => key !== 'id');
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            const values = columns.map(col => updateData[col]);
            values.push(recordId);
            
            const query = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
            
            return new Promise((resolve, reject) => {
                this.database.db.run(query, values, function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        } catch (error) {
            console.error('Error updating record:', error.message);
            throw error;
        }
    }
    
    /**
     * Delete a record from a table
     */
    async deleteRecord(tableName, recordId) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const query = `DELETE FROM ${tableName} WHERE id = ?`;
            
            return new Promise((resolve, reject) => {
                this.database.db.run(query, [recordId], function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        } catch (error) {
            console.error('Error deleting record:', error.message);
            throw error;
        }
    }
    
    /**
     * Execute a custom SQL query
     */
    async executeQuery(query) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const trimmedQuery = query.trim().toLowerCase();
            
            if (trimmedQuery.startsWith('select')) {
                // Handle SELECT queries
                const rows = await new Promise((resolve, reject) => {
                    this.database.db.all(query, [], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
                return {
                    type: 'select',
                    rows: rows,
                    count: rows.length
                };
            } else {
                // Handle INSERT, UPDATE, DELETE queries
                const result = await new Promise((resolve, reject) => {
                    this.database.db.run(query, [], function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes, lastID: this.lastID });
                    });
                });
                
                return {
                    type: 'modify',
                    changes: result.changes,
                    lastID: result.lastID,
                    message: `Query executed successfully. ${result.changes} row(s) affected.`
                };
            }
        } catch (error) {
            console.error('Error executing query:', error.message);
            throw error;
        }
    }
    
    /**
     * Export table to CSV
     */
    async exportTableToCsv(tableName) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const data = await this.getTableData(tableName);
            
            if (!data.rows || data.rows.length === 0) {
                return data.columns.join(',') + '\n';
            }
            
            let csv = data.columns.join(',') + '\n';
            
            data.rows.forEach(row => {
                const values = data.columns.map(col => {
                    let value = row[col];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });
            
            return csv;
        } catch (error) {
            console.error('Error exporting table to CSV:', error.message);
            throw error;
        }
    }
    
    /**
     * Cleanup orphaned records
     */
    async cleanupOrphanedRecords() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const query = `DELETE FROM calorie_breakdown WHERE ride_id NOT IN (SELECT id FROM rides)`;
            
            return new Promise((resolve, reject) => {
                this.database.db.run(query, [], function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        } catch (error) {
            console.error('Error cleaning up orphaned records:', error.message);
            throw error;
        }
    }
    
    /**
     * Optimize database
     */
    async optimizeDatabase() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            return new Promise((resolve, reject) => {
                this.database.db.run('VACUUM', [], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (error) {
            console.error('Error optimizing database:', error.message);
            throw error;
        }
    }
    
    /**
     * Create database backup
     */
    async createBackup() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const dbPath = this.database.dbPath;
            const backupPath = path.join(__dirname, '..', `cycling_data_backup_${Date.now()}.db`);
            
            await fs.copyFile(dbPath, backupPath);
            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error.message);
            throw error;
        }
    }
    
    /**
     * Get database information
     */
    async getDatabaseInfo() {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const fs = require('fs').promises;
            const dbPath = this.database.dbPath;
            
            const stats = await fs.stat(dbPath);
            
            // Get SQLite version
            const version = await new Promise((resolve, reject) => {
                this.database.db.get('SELECT sqlite_version() as version', [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row.version);
                });
            });
            
            // Get table information
            const tables = await new Promise((resolve, reject) => {
                this.database.db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            // Get record counts for each table
            const tableInfo = [];
            for (const table of tables) {
                const count = await new Promise((resolve, reject) => {
                    this.database.db.get(`SELECT COUNT(*) as count FROM ${table.name}`, [], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count);
                    });
                });
                
                tableInfo.push({
                    name: table.name,
                    count: count
                });
            }
            
            return {
                filePath: dbPath,
                fileSize: stats.size,
                created: stats.birthtime.toLocaleDateString('en-GB'),
                lastModified: stats.mtime.toLocaleDateString('en-GB'),
                sqliteVersion: version,
                tables: tableInfo
            };
        } catch (error) {
            console.error('Error getting database info:', error.message);
            throw error;
        }
    }
    
    /**
     * Check if a GPX file already exists by filename
     */
    async checkDuplicateByFilename(filename) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            const query = 'SELECT id, gpx_filename, ride_date FROM rides WHERE gpx_filename = ?';
            
            return new Promise((resolve, reject) => {
                this.database.db.get(query, [filename], (err, row) => {
                    if (err) reject(err);
                    else resolve(row); // Returns row if found, undefined if not found
                });
            });
        } catch (error) {
            console.error('Error checking duplicate by filename:', error.message);
            throw error;
        }
    }
    
    /**
     * Check if a GPX file already exists by content hash
     */
    async checkDuplicateByContent(distance, duration, startTime) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            // Check for rides with same distance, duration, and start time (within 1 minute)
            const query = `
                SELECT id, gpx_filename, ride_date, distance, duration 
                FROM rides 
                WHERE ABS(distance - ?) < 0.01 
                AND ABS(duration - ?) < 1 
                AND ABS(julianday(ride_date) - julianday(?)) < (1.0 / 1440)
                LIMIT 1
            `;
            
            return new Promise((resolve, reject) => {
                this.database.db.get(query, [distance, duration, startTime], (err, row) => {
                    if (err) reject(err);
                    else resolve(row); // Returns row if found, undefined if not found
                });
            });
        } catch (error) {
            console.error('Error checking duplicate by content:', error.message);
            throw error;
        }
    }
    
    /**
     * Comprehensive duplicate check
     */
    async checkForDuplicate(filename, gpxData) {
        if (!this.isInitialized) await this.initialize();
        
        try {
            // First check by filename
            const filenameMatch = await this.checkDuplicateByFilename(filename);
            if (filenameMatch) {
                return {
                    isDuplicate: true,
                    type: 'filename',
                    existing: filenameMatch,
                    message: `A file with the name "${filename}" already exists in the database.`
                };
            }
            
            // Then check by content (distance, duration, start time)
            if (gpxData && gpxData.distance && gpxData.duration && gpxData.startTime) {
                const contentMatch = await this.checkDuplicateByContent(
                    gpxData.distance,
                    gpxData.duration,
                    gpxData.startTime.toISOString()
                );
                
                if (contentMatch) {
                    return {
                        isDuplicate: true,
                        type: 'content',
                        existing: contentMatch,
                        message: `A ride with similar content already exists: "${contentMatch.gpx_filename}" (${contentMatch.distance}km, ${Math.round(contentMatch.duration)} minutes).`
                    };
                }
            }
            
            return {
                isDuplicate: false,
                type: null,
                existing: null,
                message: null
            };
        } catch (error) {
            console.error('Error checking for duplicates:', error.message);
            throw error;
        }
    }
    
    /**
     * Close database connection
     */
    async close() {
        if (this.database && this.database.db) {
            return new Promise((resolve) => {
                this.database.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('📊 Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }

    /**
     * Helper method to format duration in minutes to readable string
     */
    formatDuration(minutes) {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    /**
     * Helper method to format total time in minutes to readable string
     */
    formatTotalTime(minutes) {
        if (!minutes) return '0h';
        const hours = Math.floor(minutes / 60);
        const remainingMins = Math.floor(minutes % 60);
        
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            return `${days}d ${remainingHours}h`;
        }
        
        return hours > 0 ? `${hours}h ${remainingMins}m` : `${remainingMins}m`;
    }
}

module.exports = DatabaseService;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class CyclingDatabase {
    constructor(dbPath = './cycling_data.db') {
        this.dbPath = path.resolve(dbPath);
        this.db = null;
    }

    /**
     * Initialize the database connection and create tables
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log(`📗 Connected to SQLite database: ${this.dbPath}`);
                    this.createTables()
                        .then(() => resolve())
                        .catch(reject);
                }
            });
        });
    }

    /**
     * Create the necessary tables for storing ride data using schema.sql
     */
    async createTables() {
        try {
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = await fs.readFile(schemaPath, 'utf8');
            
            // Split SQL statements and execute them sequentially
            // Handle multiline statements properly
            const statements = [];
            const lines = schema.split('\n');
            let currentStatement = '';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                // Skip empty lines and comments
                if (trimmedLine === '' || trimmedLine.startsWith('--')) {
                    continue;
                }
                
                currentStatement += ' ' + trimmedLine;
                
                // If line ends with semicolon, we have a complete statement
                if (trimmedLine.endsWith(';')) {
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                }
            }
            
            // Add any remaining statement
            if (currentStatement.trim()) {
                statements.push(currentStatement.trim());
            }
            
            return new Promise((resolve, reject) => {
                let currentIndex = 0;
                
                const executeNext = () => {
                    if (currentIndex >= statements.length) {
                        console.log('✅ Database tables created successfully');
                        resolve();
                        return;
                    }
                    
                    const statement = statements[currentIndex];
                    this.db.run(statement, (err) => {
                        if (err) {
                            console.error(`Error executing statement ${currentIndex + 1}:`, err.message);
                            console.error(`Statement: ${statement}`);
                            reject(err);
                            return;
                        }
                        
                        currentIndex++;
                        executeNext();
                    });
                };
                
                executeNext();
            });
        } catch (error) {
            console.error('Error reading schema file:', error.message);
            throw error;
        }
    }

    /**
     * Save a ride calculation result to the database
     */
    async saveRide(result, gpxFilename = null, riderWeight = null) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const insertRideSQL = `
            INSERT INTO rides (
                gpx_filename, rider_weight, ride_date,
                distance, duration, elevation_gain, average_speed,
                start_latitude, start_longitude,
                total_calories, base_calories, elevation_calories,
                wind_adjustment, environmental_adjustment, base_met,
                calories_per_km, calories_per_hour,
                wind_speed, wind_direction, humidity, temperature,
                pressure, weather_source,
                elevation_enhanced, has_elevation_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const rideData = [
            gpxFilename,
            riderWeight,
            result.gpxData.startTime ? result.gpxData.startTime.toISOString() : null,
            result.gpxData.distance,
            result.gpxData.duration,
            result.gpxData.elevationGain,
            result.gpxData.averageSpeed,
            result.location.lat,
            result.location.lon,
            result.summary.totalCalories,
            result.summary.baseCalories,
            result.summary.elevationCalories,
            result.summary.windAdjustment,
            result.summary.environmentalAdjustment,
            result.summary.baseMET,
            result.summary.caloriesPerKm,
            result.summary.caloriesPerHour,
            result.weatherData.windSpeed,
            result.weatherData.windDirection,
            result.weatherData.humidity,
            result.weatherData.temperature,
            result.weatherData.pressure,
            result.weatherData.source,
            result.gpxData.elevationEnhanced ? 1 : 0,
            result.gpxData.hasElevation ? 1 : 0
        ];

        const rideIDPromise = await new Promise((resolve, reject) => {
            this.db.run(insertRideSQL, rideData, function(err) {
                if (err) {
                    console.error('Error saving ride data:', err.message);
                    reject(err);
                    return;
                }

                const rideId = this.lastID;
                console.log(`💾 Ride data saved with ID: ${rideId}`);
                resolve(rideId);
            });
        });

        // Save calorie breakdown data
        const insertBreakdownSQL = `
            INSERT INTO calorie_breakdown (ride_id, factor, calories, percentage, description)
            VALUES (?, ?, ?, ?, ?)
        `;
        if(rideIDPromise) {
            const breakdownPromises = result.breakdown.map(item => {
                return new Promise((resolveBreakdown, rejectBreakdown) => {
                    const breakdownData = [rideIDPromise, item.factor, item.calories, item.percentage, item.description];
                    this.db.run(insertBreakdownSQL, breakdownData, (breakdownErr) => {
                        if (breakdownErr) {
                            console.error('Error saving calorie breakdown:', breakdownErr.message);
                            rejectBreakdown(breakdownErr);
                        } else {
                            console.log(`   - Breakdown saved: ${item.factor} (${item.calories} cal)`);
                            resolveBreakdown();
                        }
                    });
                });
            });
        }
        
        return rideIDPromise;   
    }

    /**
     * Get all rides from the database
     */
    async getAllRides(limit = null, offset = 0) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        let sql = `
            SELECT * FROM rides 
            ORDER BY created_at DESC
        `;
        
        const params = [];
        if (limit) {
            sql += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get rides within a date range
     */
    async getRidesByDateRange(startDate, endDate, limit = null) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        let sql = `
            SELECT * FROM rides 
            WHERE ride_date >= ? AND ride_date <= ?
            ORDER BY ride_date DESC
        `;
        
        const params = [startDate.toISOString(), endDate.toISOString()];
        console.log('Fetching rides from:', startDate.toISOString(), 'to:', endDate.toISOString());
        if (limit) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get ride statistics
     */
    async getRideStatistics() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = `
            SELECT 
                COUNT(*) as total_rides,
                SUM(distance) as total_distance,
                SUM(duration) as total_duration,
                SUM(elevation_gain) as total_elevation_gain,
                SUM(total_calories) as total_calories,
                AVG(average_speed) as avg_speed,
                AVG(total_calories / distance) as avg_calories_per_km,
                MIN(ride_date) as first_ride,
                MAX(ride_date) as last_ride
            FROM rides
            WHERE distance > 0
        `;

        return new Promise((resolve, reject) => {
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get calorie breakdown for a specific ride
     */
    async getRideBreakdown(rideId) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = `
            SELECT * FROM calorie_breakdown 
            WHERE ride_id = ? 
            ORDER BY calories DESC
        `;

        return new Promise((resolve, reject) => {
            this.db.all(sql, [rideId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Export data to JSON
     */
    async exportToJSON(outputPath = './cycling_data_export.json') {
        const rides = await this.getAllRides();
        const stats = await this.getRideStatistics();
        
        const exportData = {
            exportDate: new Date().toISOString(),
            statistics: stats,
            rides: rides
        };

        // Add breakdown data for each ride
        for (let ride of exportData.rides) {
            ride.breakdown = await this.getRideBreakdown(ride.id);
        }

        await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
        console.log(`📊 Data exported to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Set a configuration value
     */
    async setConfig(key, value, valueType = 'string', description = null, category = 'general') {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = `
            INSERT INTO configuration (key, value, value_type, description, category, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value,
                value_type = excluded.value_type,
                description = excluded.description,
                category = excluded.category,
                updated_at = CURRENT_TIMESTAMP
        `;

        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        return new Promise((resolve, reject) => {
            this.db.run(sql, [key, stringValue, valueType, description, category], function(err) {
                if (err) {
                    console.error('Error setting configuration:', err.message);
                    reject(err);
                } else {
                    console.log(`⚙️ Configuration set: ${key} = ${stringValue}`);
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Get a configuration value
     */
    async getConfig(key, defaultValue = null) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = 'SELECT value, value_type FROM configuration WHERE key = ?';

        return new Promise((resolve, reject) => {
            this.db.get(sql, [key], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(defaultValue);
                } else {
                    // Parse value based on type
                    let parsedValue;
                    switch (row.value_type) {
                        case 'number':
                            parsedValue = Number(row.value);
                            break;
                        case 'boolean':
                            parsedValue = row.value === 'true';
                            break;
                        case 'json':
                            try {
                                parsedValue = JSON.parse(row.value);
                            } catch (e) {
                                parsedValue = row.value;
                            }
                            break;
                        default:
                            parsedValue = row.value;
                    }
                    resolve(parsedValue);
                }
            });
        });
    }

    /**
     * Get all configuration values, optionally filtered by category
     */
    async getAllConfig(category = null) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        let sql = 'SELECT * FROM configuration';
        const params = [];

        if (category) {
            sql += ' WHERE category = ?';
            params.push(category);
        }

        sql += ' ORDER BY category, key';

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse values based on their types
                    const config = {};
                    rows.forEach(row => {
                        let parsedValue;
                        switch (row.value_type) {
                            case 'number':
                                parsedValue = Number(row.value);
                                break;
                            case 'boolean':
                                parsedValue = row.value === 'true';
                                break;
                            case 'json':
                                try {
                                    parsedValue = JSON.parse(row.value);
                                } catch (e) {
                                    parsedValue = row.value;
                                }
                                break;
                            default:
                                parsedValue = row.value;
                        }
                        config[row.key] = {
                            value: parsedValue,
                            type: row.value_type,
                            description: row.description,
                            category: row.category,
                            updated_at: row.updated_at
                        };
                    });
                    resolve(config);
                }
            });
        });
    }

    /**
     * Delete a configuration value
     */
    async deleteConfig(key) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = 'DELETE FROM configuration WHERE key = ?';

        return new Promise((resolve, reject) => {
            this.db.run(sql, [key], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`⚙️ Configuration deleted: ${key}`);
                    resolve(this.changes > 0);
                }
            });
        });
    }

    /**
     * Initialize default configuration values
     */
    async initializeDefaultConfig() {
        const defaults = [
            { key: 'default_rider_weight', value: 70, valueType: 'number', description: 'Default rider weight in kg', category: 'rider' },
            { key: 'weather_api_key', value: '', valueType: 'string', description: 'Weather API key (OpenWeatherMap or similar)', category: 'api' },
            { key: 'weather_api_timeout', value: 5000, valueType: 'number', description: 'Weather API timeout in milliseconds', category: 'api' },
            { key: 'weather_api_base_url', value: 'https://api.openweathermap.org/data/2.5', valueType: 'string', description: 'Weather API base URL', category: 'api' },
            { key: 'enable_elevation_enhancement', value: true, valueType: 'boolean', description: 'Enable elevation data enhancement', category: 'processing' },
            { key: 'default_wind_resistance', value: 0.9, valueType: 'number', description: 'Default wind resistance coefficient', category: 'physics' },
            { key: 'database_backup_enabled', value: false, valueType: 'boolean', description: 'Enable automatic database backups', category: 'system' },
            { key: 'max_rides_per_export', value: 1000, valueType: 'number', description: 'Maximum number of rides per export', category: 'export' }
        ];

        for (const config of defaults) {
            const existing = await this.getConfig(config.key);
            if (existing === null) {
                await this.setConfig(config.key, config.value, config.valueType, config.description, config.category);
            }
        }

        console.log('⚙️ Default configuration values initialized');
    }

    /**
     * Set the weather API key
     */
    async setWeatherApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('API key must be a non-empty string');
        }
        
        await this.setConfig('weather_api_key', apiKey, 'string', 'Weather API key (OpenWeatherMap or similar)', 'api');
        console.log('🔑 Weather API key updated successfully');
    }

    /**
     * Get the weather API key
     */
    async getWeatherApiKey() {
        const apiKey = await this.getConfig('weather_api_key');
        if (!apiKey) {
            console.warn('⚠️  Weather API key not configured. Use setWeatherApiKey() to set it.');
            return null;
        }
        return apiKey;
    }

    /**
     * Check if weather API key is configured
     */
    async hasWeatherApiKey() {
        const apiKey = await this.getConfig('weather_api_key');
        return apiKey && apiKey.length > 0;
    }

    /**
     * Get weather API configuration
     */
    async getWeatherApiConfig() {
        const config = await this.getAllConfig('api');
        return {
            apiKey: config.weather_api_key?.value || null,
            baseUrl: config.weather_api_base_url?.value || 'https://api.openweathermap.org/data/2.5',
            timeout: config.weather_api_timeout?.value || 5000,
            hasKey: config.weather_api_key?.value && config.weather_api_key.value.length > 0
        };
    }

    /**
     * Update weather API configuration
     */
    async setWeatherApiConfig(options = {}) {
        const { apiKey, baseUrl, timeout } = options;
        
        if (apiKey !== undefined) {
            await this.setConfig('weather_api_key', apiKey, 'string', 'Weather API key (OpenWeatherMap or similar)', 'api');
        }
        
        if (baseUrl !== undefined) {
            await this.setConfig('weather_api_base_url', baseUrl, 'string', 'Weather API base URL', 'api');
        }
        
        if (timeout !== undefined) {
            await this.setConfig('weather_api_timeout', timeout, 'number', 'Weather API timeout in milliseconds', 'api');
        }
        
        console.log('🌤️  Weather API configuration updated');
    }

    /**
     * Get all configuration as array for API
     */
    async getAllConfiguration() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = `
            SELECT key, value, value_type, description, category, updated_at, created_at
            FROM configuration 
            ORDER BY category, key
        `;

        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse values based on type
                    const configs = rows.map(row => {
                        let parsedValue;
                        switch (row.value_type) {
                            case 'number':
                                parsedValue = parseFloat(row.value);
                                break;
                            case 'boolean':
                                parsedValue = row.value === 'true';
                                break;
                            case 'json':
                                try {
                                    parsedValue = JSON.parse(row.value);
                                } catch {
                                    parsedValue = row.value;
                                }
                                break;
                            default:
                                parsedValue = row.value;
                        }
                        return {
                            key: row.key,
                            value: parsedValue,
                            value_type: row.value_type,
                            description: row.description || '',
                            category: row.category || 'general',
                            updated_at: row.updated_at,
                            created_at: row.created_at
                        };
                    });
                    resolve(configs);
                }
            });
        });
    }

    /**
     * Update a configuration value by key
     */
    async updateConfiguration(key, value, valueType = null) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        // If valueType is not provided, try to get existing type
        if (!valueType) {
            const existing = await this.getConfig(key);
            if (existing === null) {
                throw new Error(`Configuration key '${key}' does not exist`);
            }
            // Get the type from the database
            const typeQuery = 'SELECT value_type FROM configuration WHERE key = ?';
            valueType = await new Promise((resolve, reject) => {
                this.db.get(typeQuery, [key], (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.value_type : 'string');
                });
            });
        }

        // Convert value to string for storage
        let stringValue;
        if (valueType === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else if (valueType === 'json') {
            stringValue = JSON.stringify(value);
        } else {
            stringValue = String(value);
        }

        const sql = 'UPDATE configuration SET value = ?, value_type = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?';

        return new Promise((resolve, reject) => {
            this.db.run(sql, [stringValue, valueType, key], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`⚙️ Configuration updated: ${key} = ${value}`);
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    /**
     * Add a new configuration value
     */
    async addConfiguration(key, value, valueType = 'string', description = '', category = 'general') {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        // Convert value to string for storage
        let stringValue;
        if (valueType === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else if (valueType === 'json') {
            stringValue = JSON.stringify(value);
        } else {
            stringValue = String(value);
        }

        const sql = `
            INSERT INTO configuration (key, value, value_type, description, category) 
            VALUES (?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [key, stringValue, valueType, description, category], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`⚙️ Configuration added: ${key} = ${value}`);
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Delete a configuration value by key
     */
    async deleteConfiguration(key) {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const sql = 'DELETE FROM configuration WHERE key = ?';

        return new Promise((resolve, reject) => {
            this.db.run(sql, [key], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`⚙️ Configuration deleted: ${key}`);
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    /**
     * Close the database connection
     */
    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('📗 Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = CyclingDatabase;
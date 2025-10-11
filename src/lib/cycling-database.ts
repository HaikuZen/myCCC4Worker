interface RideData {
  gpxData: {
    startTime?: Date | null;
    distance: number;
    duration: number;
    elevationGain: number;
    averageSpeed: number;
    elevationEnhanced?: boolean;
    hasElevation?: boolean;
  };
  location: {
    lat: number;
    lon: number;
  };
  summary: {
    totalCalories: number;
    baseCalories: number;
    elevationCalories: number;
    windAdjustment: number;
    environmentalAdjustment: number;
    baseMET: number;
    caloriesPerKm: number;
    caloriesPerHour: number;
  };
  weatherData: {
    windSpeed: number;
    windDirection: number;
    humidity: number;
    temperature: number;
    pressure: number;
    source: string;
  };
  breakdown?: Array<{
    factor: string;
    calories: number;
    percentage: number;
    description: string;
  }>;
}

interface ConfigDefault {
  key: string;
  value: any;
  valueType: string;
  description: string;
  category: string;
}

interface DatabaseRow {
  id: number;
  user_id: number | null;
  gpx_filename: string;
  gpx_data: Uint8Array | null;
  rider_weight: number;
  ride_date: string;
  distance: number;
  duration: number;
  elevation_gain: number;
  average_speed: number;
  start_latitude: number;
  start_longitude: number;
  total_calories: number;
  base_calories: number;
  elevation_calories: number;
  wind_adjustment: number;
  environmental_adjustment: number;
  base_met: number;
  calories_per_km: number;
  calories_per_hour: number;
  wind_speed: number;
  wind_direction: number;
  humidity: number;
  temperature: number;
  pressure: number;
  weather_source: string;
  elevation_enhanced: number;
  has_elevation_data: number;
  created_at: string;
  updated_at: string;
}

interface ConfigurationRow {
  id?: number;
  key: string;
  value: string;
  value_type: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

interface CalorieBreakdownRow {
  id?: number;
  ride_id: number;
  factor: string;
  calories: number;
  percentage: number;
  description?: string;
  created_at?: string;
}

import { createLogger } from './logger';

// D1Database is a global type in Cloudflare Workers environment
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<D1Result>;
  }
  
  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    all<T = any>(): Promise<D1Result<T>>;
    first<T = any>(): Promise<T | null>;
    run(): Promise<D1Result>;
  }
  
  interface D1Result<T = any> {
    results: T[];
    success: boolean;
    meta: {
      last_row_id?: number;
      changes?: number;
    };
  }
}

// Export interfaces for use in DatabaseService
export interface GlobalStatistics {
  total_rides: number;
  total_distance: number;
  total_calories: number;
  total_duration: number;
  avg_speed: number;
  total_elevation_gain: number;
  avg_calories_per_km: number;
  first_ride: string | null;
  last_ride: string | null;
}

export interface RideRecord {
  id: number;
  user_id: number | null;
  gpx_filename: string;
  ride_date: string;
  distance: number;
  total_calories: number;
  duration: number;
  average_speed: number;
  elevation_gain: number;
}

export interface DuplicateCheckResult {
  id: number;
  gpx_filename: string;
  ride_date: string;
  distance?: number;
  duration?: number;
}

export class CyclingDatabase {
  private db: D1Database;
  private isInitialized: boolean = false;
  private log = createLogger('CyclingDatabase');
  
  /**
   * Valid tables that can be accessed in database operations
   * This array includes all tables that support CRUD operations
   */
  protected readonly validTables = ['rides', 'calorie_breakdown', 'configuration', 'users', 'sessions', 'invitations', 'profiles'];

  constructor(db: D1Database) {
    this.db = db;
    this.isInitialized = true; // Assume initialized for D1
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize(force: Boolean | null = false): Promise<void> {
    if (this.isInitialized && !force) return;
    
    try {
      await this.createTables();
      this.log.info('📗 Connected to D1 database');
      this.isInitialized = true;
    } catch (error) {
      this.log.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Create the necessary tables for storing ride data
   */
  private async createTables(): Promise<void> {
    try {
      // For D1, define schema directly since Workers can't read files
      const createTablesSQL = `
        -- Rides table;
        CREATE TABLE IF NOT EXISTS rides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          gpx_filename TEXT,
          gpx_data BLOB,
          rider_weight REAL DEFAULT 70,
          ride_date TEXT,
          distance REAL NOT NULL,
          duration REAL NOT NULL,
          elevation_gain REAL DEFAULT 0,
          average_speed REAL,
          start_latitude REAL,
          start_longitude REAL,
          total_calories REAL,
          base_calories REAL DEFAULT 0,
          elevation_calories REAL DEFAULT 0,
          wind_adjustment REAL DEFAULT 0,
          environmental_adjustment REAL DEFAULT 0,
          base_met REAL DEFAULT 0,
          calories_per_km REAL DEFAULT 0,
          calories_per_hour REAL DEFAULT 0,
          wind_speed REAL DEFAULT 0,
          wind_direction REAL DEFAULT 0,
          humidity REAL DEFAULT 50,
          temperature REAL DEFAULT 20,
          pressure REAL DEFAULT 1013,
          weather_source TEXT DEFAULT 'default',
          elevation_enhanced BOOLEAN DEFAULT 0,
          has_elevation_data BOOLEAN DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Calorie breakdown table;
        CREATE TABLE IF NOT EXISTS calorie_breakdown (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ride_id INTEGER NOT NULL,
          factor TEXT NOT NULL,
          calories REAL NOT NULL,
          percentage REAL NOT NULL,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE
        );

        -- Configuration table;
        CREATE TABLE IF NOT EXISTS configuration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          value_type TEXT DEFAULT 'string',
          description TEXT,
          category TEXT DEFAULT 'general',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes;
        CREATE INDEX IF NOT EXISTS idx_rides_date ON rides(ride_date);
        CREATE INDEX IF NOT EXISTS idx_rides_filename ON rides(gpx_filename);
        CREATE INDEX IF NOT EXISTS idx_calorie_breakdown_ride_id ON calorie_breakdown(ride_id);
        CREATE INDEX IF NOT EXISTS idx_configuration_key ON configuration(key);
        CREATE INDEX IF NOT EXISTS idx_configuration_category ON configuration(category);
      `;
      
      this.log.info('Creating database tables if they do not exist...');  
      // Split into individual statements and execute
      const statements = createTablesSQL
        .split(';')
        .map(stmt => stmt.trim().replaceAll('\n', ' '))
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
      for (const statement of statements) {        
        if (statement.trim()) {
          this.log.info('Executing SQL:', statement.substring(0, 60) + (statement.length > 60 ? '...' : ''));
          await this.db.exec(statement);
        }
      }
      
      this.log.info('✅ Database tables created successfully');
    } catch (error) {
      this.log.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Save a ride calculation result to the database
   */
  async saveRide(result: RideData, gpxFilename: string | null = null, riderWeight: number | null = null, gpxData: string | null = null, userId: number | null = null): Promise<number> {
    if (!this.isInitialized) await this.initialize();

    const insertRideSQL = `
      INSERT INTO rides (
        user_id, gpx_filename, gpx_data, rider_weight, ride_date,
        distance, duration, elevation_gain, average_speed,
        start_latitude, start_longitude,
        total_calories, base_calories, elevation_calories,
        wind_adjustment, environmental_adjustment, base_met,
        calories_per_km, calories_per_hour,
        wind_speed, wind_direction, humidity, temperature,
        pressure, weather_source,
        elevation_enhanced, has_elevation_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const rideData = [
      userId,
      gpxFilename,
      gpxData ? new TextEncoder().encode(gpxData) : null,
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

    try {
      const insertResult = await this.db.prepare(insertRideSQL).bind(...rideData).run();
      
      if (insertResult.success && insertResult.meta.last_row_id) {
        const rideId = insertResult.meta.last_row_id as number;
        this.log.info(`💾 Ride data saved with ID: ${rideId}`);

        // Save calorie breakdown data
        const insertBreakdownSQL = `
          INSERT INTO calorie_breakdown (ride_id, factor, calories, percentage, description)
          VALUES (?, ?, ?, ?, ?)
        `;

        if (result.breakdown && Array.isArray(result.breakdown)) {
          for (const item of result.breakdown) {
            const breakdownData = [rideId, item.factor, item.calories, item.percentage, item.description];
            const breakdownResult = await this.db.prepare(insertBreakdownSQL).bind(...breakdownData).run();
            
            if (breakdownResult.success) {
              this.log.info(`   - Breakdown saved: ${item.factor} (${item.calories} cal)`);
            } else {
              this.log.error('Error saving calorie breakdown:', breakdownResult);
            }
          }
        }

        return rideId;
      } else {
        throw new Error('Failed to insert ride data');
      }
    } catch (error) {
      this.log.error('Error saving ride data:', error);
      throw error;
    }
  }

  /**
   * Get all rides from the database
   */
  async getAllRides(limit: number | null = null, offset: number = 0): Promise<DatabaseRow[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      let sql = `
        SELECT * FROM rides 
        ORDER BY created_at DESC
      `;
      
      const params: any[] = [];
      if (limit) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const result = await this.db.prepare(sql).bind(...params).all<DatabaseRow>();
      return result.results || [];
    } catch (error) {
      this.log.error('Error getting all rides:', error);
      throw error;
    }
  }

  /**
   * Get rides within a date range
   */
  async getRidesByDateRange(startDate: Date, endDate: Date, limit: number | null = null): Promise<DatabaseRow[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      let sql = `
        SELECT * FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date DESC
      `;
      
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      this.log.info('Fetching rides from:', startDate.toISOString(), 'to:', endDate.toISOString());
      
      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const result = await this.db.prepare(sql).bind(...params).all<DatabaseRow>();
      return result.results || [];
    } catch (error) {
      this.log.error('Error getting rides by date range:', error);
      throw error;
    }
  }

  /**
   * Get ride statistics
   */
  async getRideStatistics(): Promise<any> {
    if (!this.isInitialized) await this.initialize();

    try {
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

      const result = await this.db.prepare(sql).first();
      return result;
    } catch (error) {
      this.log.error('Error getting ride statistics:', error);
      throw error;
    }
  }

  /**
   * Get calorie breakdown for a specific ride
   */
  async getRideBreakdown(rideId: number): Promise<CalorieBreakdownRow[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const sql = `
        SELECT * FROM calorie_breakdown 
        WHERE ride_id = ? 
        ORDER BY calories DESC
      `;

      const result = await this.db.prepare(sql).bind(rideId).all<CalorieBreakdownRow>();
      return result.results || [];
    } catch (error) {
      this.log.error('Error getting ride breakdown:', error);
      throw error;
    }
  }

  /**
   * Export data to JSON (returns data instead of writing to file in Workers)
   */
  async exportToJSON(): Promise<any> {
    try {
      const rides = await this.getAllRides();
      const stats = await this.getRideStatistics();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        statistics: stats,
        rides: rides as any[]
      };

      // Add breakdown data for each ride
      for (const ride of exportData.rides) {
        ride.breakdown = await this.getRideBreakdown(ride.id);
      }

      this.log.info('📊 Data exported successfully');
      return exportData;
    } catch (error) {
      this.log.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Set a configuration value
   */
  async setConfig(key: string, value: any, valueType: string = 'string', description: string | null = null, category: string = 'general'): Promise<number> {
    if (!this.isInitialized) await this.initialize();

    try {
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
      const result = await this.db.prepare(sql).bind(key, stringValue, valueType, description, category).run();
      
      if (result.success && result.meta.last_row_id) {
        this.log.info(`⚙️ Configuration set: ${key} = ${stringValue}`);
        return result.meta.last_row_id as number;
      } else {
        throw new Error('Failed to set configuration');
      }
    } catch (error) {
      this.log.error('Error setting configuration:', error);
      throw error;
    }
  }

  /**
   * Get a configuration value
   */
  async getConfig(key: string, defaultValue: any = null): Promise<any> {
    if (!this.isInitialized) await this.initialize();

    try {
      const sql = 'SELECT value, value_type FROM configuration WHERE key = ?';
      const result = await this.db.prepare(sql).bind(key).first<ConfigurationRow>();
      
      if (!result) {
        return defaultValue;
      }

      // Parse value based on type
      let parsedValue: any;
      switch (result.value_type) {
        case 'number':
          parsedValue = Number(result.value);
          break;
        case 'boolean':
          parsedValue = result.value === 'true';
          break;
        case 'json':
          try {
            parsedValue = JSON.parse(result.value);
          } catch (e) {
            parsedValue = result.value;
          }
          break;
        default:
          parsedValue = result.value;
      }
      
      return parsedValue;
    } catch (error) {
      this.log.error('Error getting configuration:', error);
      throw error;
    }
  }

  /**
   * Get all configuration values, optionally filtered by category
   */
  async getAllConfig(category: string | null = null): Promise<Record<string, any>> {
    if (!this.isInitialized) await this.initialize();

    try {
      let sql = 'SELECT * FROM configuration';
      const params: any[] = [];

      if (category) {
        sql += ' WHERE category = ?';
        params.push(category);
      }

      sql += ' ORDER BY category, key';

      const result = await this.db.prepare(sql).bind(...params).all<ConfigurationRow>();
      const rows = result.results || [];
      
      // Parse values based on their types
      const config: Record<string, any> = {};
      rows.forEach((row: ConfigurationRow) => {
        let parsedValue: any;
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
      
      return config;
    } catch (error) {
      this.log.error('Error getting all configuration:', error);
      throw error;
    }
  }

  /**
   * Delete a configuration value
   */
  async deleteConfig(key: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    try {
      const sql = 'DELETE FROM configuration WHERE key = ?';
      const result = await this.db.prepare(sql).bind(key).run();
      
      if (result.success) {
        this.log.info(`⚙️ Configuration deleted: ${key}`);
        return (result.meta.changes || 0) > 0;
      }
      
      return false;
    } catch (error) {
      this.log.error('Error deleting configuration:', error);
      throw error;
    }
  }

  /**
   * Initialize default configuration values
   */
  async initializeDefaultConfig(): Promise<ConfigDefault[]> {
    const defaults: ConfigDefault[] = [
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

    this.log.info('⚙️ Default configuration values initialized');
    return defaults;
  }

  /**
   * Set the weather API key
   */
  async setWeatherApiKey(apiKey: string): Promise<void> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }
    
    await this.setConfig('weather_api_key', apiKey, 'string', 'Weather API key (OpenWeatherMap or similar)', 'api');
    this.log.info('🔑 Weather API key updated successfully');
  }

  /**
   * Get the weather API key
   */
  async getWeatherApiKey(): Promise<string | null> {
    const apiKey = await this.getConfig('weather_api_key');
    if (!apiKey) {
      this.log.warn('⚠️  Weather API key not configured. Use setWeatherApiKey() to set it.');
      return null;
    }
    return apiKey;
  }

  /**
   * Check if weather API key is configured
   */
  async hasWeatherApiKey(): Promise<boolean> {
    const apiKey = await this.getConfig('weather_api_key');
    return apiKey && apiKey.length > 0;
  }

  /**
   * Get weather API configuration
   */
  async getWeatherApiConfig(): Promise<any> {
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
  async setWeatherApiConfig(options: { apiKey?: string; baseUrl?: string; timeout?: number } = {}): Promise<void> {
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
    
    this.log.info('🌤️  Weather API configuration updated');
  }

  /**
   * Get all configuration as array for API
   */
  async getAllConfiguration(): Promise<any[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const sql = `
        SELECT key, value, value_type, description, category, updated_at, created_at
        FROM configuration 
        ORDER BY category, key
      `;

      const result = await this.db.prepare(sql).all<ConfigurationRow>();
      const rows = result.results || [];
      
      // Parse values based on type
      const configs = rows.map((row: ConfigurationRow) => {
        let parsedValue: any;
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
      
      return configs;
    } catch (error) {
      this.log.error('Error getting all configuration:', error);
      throw error;
    }
  }

  /**
   * Update a configuration value by key
   */
  async updateConfiguration(key: string, value: any, valueType: string | null = null): Promise<{ changes: number }> {
    if (!this.isInitialized) await this.initialize();

    try {
      // If valueType is not provided, try to get existing type
      if (!valueType) {
        const existing = await this.getConfig(key);
        if (existing === null) {
          throw new Error(`Configuration key '${key}' does not exist`);
        }
        // Get the type from the database
        const typeQuery = 'SELECT value_type FROM configuration WHERE key = ?';
        const typeResult = await this.db.prepare(typeQuery).bind(key).first<ConfigurationRow>();
        valueType = typeResult ? typeResult.value_type : 'string';
      }

      // Convert value to string for storage
      let stringValue: string;
      if (valueType === 'boolean') {
        stringValue = value ? 'true' : 'false';
      } else if (valueType === 'json') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      const sql = 'UPDATE configuration SET value = ?, value_type = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?';
      const result = await this.db.prepare(sql).bind(stringValue, valueType, key).run();
      
      if (result.success) {
        this.log.info(`⚙️ Configuration updated: ${key} = ${value}`);
        return { changes: result.meta.changes || 0 };
      } else {
        throw new Error('Failed to update configuration');
      }
    } catch (error) {
      this.log.error('Error updating configuration:', error);
      throw error;
    }
  }

  /**
   * Add a new configuration value
   */
  async addConfiguration(key: string, value: any, valueType: string = 'string', description: string = '', category: string = 'general'): Promise<{ id: number }> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Convert value to string for storage
      let stringValue: string;
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

      const result = await this.db.prepare(sql).bind(key, stringValue, valueType, description, category).run();
      
      if (result.success && result.meta.last_row_id) {
        this.log.info(`⚙️ Configuration added: ${key} = ${value}`);
        return { id: result.meta.last_row_id as number };
      } else {
        throw new Error('Failed to add configuration');
      }
    } catch (error) {
      this.log.error('Error adding configuration:', error);
      throw error;
    }
  }

  /**
   * Delete a configuration value by key
   */
  async deleteConfiguration(key: string): Promise<{ changes: number }> {
    if (!this.isInitialized) await this.initialize();

    try {
      const sql = 'DELETE FROM configuration WHERE key = ?';
      const result = await this.db.prepare(sql).bind(key).run();
      
      if (result.success) {
        this.log.info(`⛙️ Configuration deleted: ${key}`);
        return { changes: result.meta.changes || 0 };
      } else {
        throw new Error('Failed to delete configuration');
      }
    } catch (error) {
      this.log.error('Error deleting configuration:', error);
      throw error;
    }
  }

  // ============= Database Query Methods for DatabaseService =============
  
  /**
   * Get global statistics for dashboard
   */
  async getGlobalStatisticsFromDB(userId?: number | null): Promise<GlobalStatistics | null> {
    if (!this.isInitialized) await this.initialize();
    
    let query = `
      SELECT 
        COUNT(*) as total_rides,
        COALESCE(SUM(distance), 0) as total_distance,
        COALESCE(SUM(total_calories), 0) as total_calories,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(AVG(average_speed), 0) as avg_speed,
        COALESCE(SUM(elevation_gain), 0) as total_elevation_gain,
        COALESCE(AVG(total_calories / NULLIF(distance, 0)), 0) as avg_calories_per_km,
        MIN(ride_date) as first_ride,
        MAX(ride_date) as last_ride
      FROM rides
    `;
    
    if (userId !== undefined && userId !== null) {
      query += ' WHERE user_id = ?';
      const result = await this.db.prepare(query).bind(userId).first<GlobalStatistics>();
      return result;
    }
    
    const result = await this.db.prepare(query).first<GlobalStatistics>();
    return result;
  }

  /**
   * Get recent rides
   */
  async getRecentRidesFromDB(limit: number = 10, userId?: number | null): Promise<RideRecord[]> {
    if (!this.isInitialized) await this.initialize();
    
    let query = `
      SELECT id, user_id, gpx_filename, ride_date, distance, total_calories, 
             duration, average_speed, elevation_gain
      FROM rides
    `;
    
    const params: any[] = [];
    
    if (userId !== undefined && userId !== null) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY ride_date DESC LIMIT ?';
    params.push(limit);
    
    const result = await this.db.prepare(query).bind(...params).all<RideRecord>();
    return result.results || [];
  }

  /**
   * Get rides in date range
   */
  async getRidesInDateRangeFromDB(startDate: Date, endDate: Date, limit?: number, userId?: number | null): Promise<RideRecord[]> {
    if (!this.isInitialized) await this.initialize();
    
    let query = `
      SELECT id, user_id, gpx_filename, ride_date, distance, total_calories, 
             duration, average_speed, elevation_gain
      FROM rides 
      WHERE ride_date >= ? AND ride_date <= ?
    `;
    
    const params: any[] = [startDate.toISOString(), endDate.toISOString()];
    
    if (userId !== undefined && userId !== null) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY ride_date DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }
    
    const result = await this.db.prepare(query).bind(...params).all<RideRecord>();
    return result.results || [];
  }

  /**
   * Get rides for chart data
   */
  async getRidesForChart(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT ride_date, distance, total_calories, average_speed, elevation_gain
      FROM rides 
      WHERE ride_date >= ? AND ride_date <= ?
      ORDER BY ride_date
    `;
    
    const result = await this.db.prepare(query)
      .bind(startDate.toISOString(), endDate.toISOString())
      .all();
    
    return result.results || [];
  }

  /**
   * Get rides for monthly summary  
   */
  async getRidesForMonthlySummary(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT ride_date, distance, total_calories, elevation_gain
      FROM rides 
      WHERE ride_date >= ? AND ride_date <= ?
      ORDER BY ride_date
    `;
    
    const result = await this.db.prepare(query)
      .bind(startDate.toISOString(), endDate.toISOString())
      .all();
    
    return result.results || [];
  }

  /**
   * Get rides for performance trends
   */
  async getRidesForTrends(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT average_speed, total_calories, distance, duration
      FROM rides 
      WHERE ride_date >= ? AND ride_date <= ?
      ORDER BY ride_date
    `;
    
    const result = await this.db.prepare(query)
      .bind(startDate.toISOString(), endDate.toISOString())
      .all();
    
    return result.results || [];
  }

  /**
   * Save GPX analysis
   */
  async saveGPXAnalysis(analysisData: any, gpxFilename: string, riderWeight: number = 70, gpxData: string | null = null, userId: number | null = null): Promise<number> {
    if (!this.isInitialized) await this.initialize();
    
    const insertRideSQL = `
      INSERT INTO rides (
        user_id, gpx_filename, gpx_data, rider_weight, ride_date,
        distance, duration, elevation_gain, average_speed,
        start_latitude, start_longitude,
        total_calories, base_calories, elevation_calories,
        wind_adjustment, environmental_adjustment, base_met,
        calories_per_km, calories_per_hour,
        wind_speed, wind_direction, humidity, temperature,
        pressure, weather_source, has_weather_data,
        elevation_enhanced, has_elevation_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const rideData = [
      userId,
      gpxFilename,
      gpxData ? new TextEncoder().encode(gpxData) : null,
      riderWeight,
      analysisData.summary.startTime ? analysisData.summary.startTime.toISOString() : null,
      analysisData.summary.distance,
      analysisData.summary.totalTime / 60, // Convert to minutes
      analysisData.summary.elevationGain,
      analysisData.summary.avgSpeed,
      analysisData.points[0]?.lat || 0,
      analysisData.points[0]?.lon || 0,
      analysisData.analysis.caloriesBurned.estimated,
      analysisData.analysis.caloriesBurned.breakdown.base || 0,
      analysisData.analysis.caloriesBurned.breakdown.elevation || 0,
      0, // wind adjustment
      0, // environmental adjustment
      0, // base MET
      Math.round(analysisData.analysis.caloriesBurned.estimated / analysisData.summary.distance),
      Math.round(analysisData.analysis.caloriesBurned.estimated / (analysisData.summary.totalTime / 3600)),
      analysisData.analysis.weather?.wind || null, // wind speed
      analysisData.analysis.weather?.windDirection || 0, // wind direction
      analysisData.analysis.weather?.humidity || null, // humidity
      analysisData.analysis.weather?.temp || null, // temperature
      analysisData.analysis.weather?.pressure || null, // pressure
      analysisData.analysis.weatherProvider || 'none', // weather source
      analysisData.analysis.hasWeatherData || false, // has weather data
      false, // elevation enhanced
      analysisData.summary.elevationGain > 0 // has elevation data
    ];

    const result = await this.db.prepare(insertRideSQL).bind(...rideData).run();
    
    if (result.success && result.meta.last_row_id) {
      this.log.info(`💾 Saved ride analysis to database with ID: ${result.meta.last_row_id}`);
      return result.meta.last_row_id as number;
    } else {
      throw new Error('Failed to insert ride data');
    }
  }

  /**
   * Check duplicate by filename
   */
  async checkDuplicateByFilename(filename: string): Promise<DuplicateCheckResult | null> {
    if (!this.isInitialized) await this.initialize();
    
    const query = 'SELECT id, gpx_filename, ride_date FROM rides WHERE gpx_filename = ?';
    const result = await this.db.prepare(query).bind(filename).first<DuplicateCheckResult>();
    return result || null;
  }

  /**
   * Check duplicate by content
   */
  async checkDuplicateByContent(distance: number, duration: number, startTime: string): Promise<DuplicateCheckResult | null> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT id, gpx_filename, ride_date, distance, duration 
      FROM rides 
      WHERE ABS(distance - ?) < 0.01 
      AND ABS(duration - ?) < 1 
      AND ABS(julianday(ride_date) - julianday(?)) < (1.0 / 1440)
      LIMIT 1
    `;
    
    const result = await this.db.prepare(query).bind(distance, duration, startTime).first<DuplicateCheckResult>()
    return result || null
  }

  /**
   * Get chart data for visualization
   */
  async getChartData(startDate: string = '1999-01-01', endDate: string = '2999-12-31'): Promise<any[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        SELECT ride_date, distance, total_calories, average_speed, elevation_gain
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(new Date(startDate).toISOString(), new Date(endDate).toISOString())
        .all()
      
      const rides = result.results
      
      // Group rides by date
      const dateGroups: Record<string, any> = {}
      rides.forEach((ride: any) => {
        const dateKey = ride.ride_date ? new Date(ride.ride_date).toDateString() : 'Unknown'
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = {
            date: dateKey,
            distance: 0,
            calories: 0,
            rides: 0,
            avgSpeed: 0,
            elevation: 0
          }
        }
        dateGroups[dateKey].distance += ride.distance || 0
        dateGroups[dateKey].calories += ride.total_calories || 0
        dateGroups[dateKey].rides += 1
        dateGroups[dateKey].avgSpeed += ride.average_speed || 0
        dateGroups[dateKey].elevation += ride.elevation_gain || 0
      })
      
      // Calculate averages and format data
      const chartData = Object.values(dateGroups).map((group: any) => ({
        date: group.date,
        distance: parseFloat(group.distance.toFixed(1)),
        calories: Math.round(group.calories),
        rides: group.rides,
        avgSpeed: parseFloat((group.avgSpeed / group.rides).toFixed(1)),
        elevation: Math.round(group.elevation)
      }))
      
      // Sort by date
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return chartData
    } catch (error) {
      this.log.error('Error getting chart data:', error)
      return []
    }
  }

  /**
   * Get monthly summary data
   */
  async getMonthlySummary(): Promise<any[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Get rides from the last 12 months
      const endDate = new Date()
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
      
      const query = `
        SELECT ride_date, distance, total_calories, elevation_gain
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(startDate.toISOString(), endDate.toISOString())
        .all()
      
      const rides = result.results
      
      // Group by month
      const monthGroups: Record<string, any> = {}
      rides.forEach((ride: any) => {
        if (ride.ride_date) {
          const date = new Date(ride.ride_date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
              month: monthKey,
              distance: 0,
              calories: 0,
              rides: 0,
              elevation: 0
            }
          }
          
          monthGroups[monthKey].distance += ride.distance || 0
          monthGroups[monthKey].calories += ride.total_calories || 0
          monthGroups[monthKey].rides += 1
          monthGroups[monthKey].elevation += ride.elevation_gain || 0
        }
      })
      
      return Object.values(monthGroups).map((month: any) => ({
        month: month.month,
        distance: parseFloat(month.distance.toFixed(1)),
        calories: Math.round(month.calories),
        rides: month.rides,
        elevation: Math.round(month.elevation)
      })).sort((a, b) => a.month.localeCompare(b.month))
    } catch (error) {
      this.log.error('Error getting monthly summary:', error)
      return []
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(days: number = 90): Promise<any> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      
      const query = `
        SELECT average_speed, total_calories, distance, duration
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(startDate.toISOString(), endDate.toISOString())
        .all()
      
      const rides = result.results
      if (rides.length === 0) return null
      
      // Calculate trends
      const halfPoint = Math.floor(rides.length / 2)
      const firstHalf = rides.slice(0, halfPoint)
      const secondHalf = rides.slice(halfPoint)
      
      const getAverage = (rides: any[], field: string) => {
        const sum = rides.reduce((acc, ride) => acc + (ride[field] || 0), 0)
        return rides.length > 0 ? sum / rides.length : 0
      }
      
      const trends = {
        speed: {
          first: getAverage(firstHalf, 'average_speed'),
          second: getAverage(secondHalf, 'average_speed'),
          change: 0
        },
        caloriesPerKm: {
          first: firstHalf.reduce((sum, r: any) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (firstHalf.length || 1),
          second: secondHalf.reduce((sum, r: any) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (secondHalf.length || 1),
          change: 0
        },
        distance: {
          first: getAverage(firstHalf, 'distance'),
          second: getAverage(secondHalf, 'distance'),
          change: 0
        }
      }
      
      // Calculate percentage changes
      Object.keys(trends).forEach(key => {
        const trend = (trends as any)[key]
        if (trend.first > 0) {
          trend.change = ((trend.second - trend.first) / trend.first) * 100
        }
      })
      
      return trends
    } catch (error) {
      this.log.error('Error getting performance trends:', error)
      return null
    }
  }

  /**
   * Comprehensive duplicate check
   */
  async checkForDuplicate(filename: string, gpxData: any): Promise<any> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // First check by filename
      const filenameMatch = await this.checkDuplicateByFilename(filename)
      if (filenameMatch) {
        return {
          isDuplicate: true,
          type: 'filename',
          existing: filenameMatch,
          message: `A file with the name "${filename}" already exists in the database.`
        }
      }
      
      // Then check by content (distance, duration, start time)
      if (gpxData && gpxData.distance && gpxData.duration && gpxData.startTime) {
        const contentMatch = await this.checkDuplicateByContent(
          gpxData.distance, 
          gpxData.duration, 
          gpxData.startTime.toISOString()
        )
        if (contentMatch) {
          return {
            isDuplicate: true,
            type: 'content',
            existing: contentMatch,
            message: `A ride with similar content already exists: "${contentMatch.gpx_filename}" (${contentMatch.distance}km, ${Math.round(contentMatch.duration)} minutes).`
          }
        }
      }
      
      return {
        isDuplicate: false,
        type: null,
        existing: null,
        message: null
      }
    } catch (error) {
      this.log.error('Error checking for duplicates:', error)
      throw error
    }
  }

  /**
   * Helper method to format duration in minutes to readable string
   */
  formatDuration(minutes: number): string {
    if (!minutes) return '0m'
    
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  /**
   * Helper method to format total time in minutes to readable string
   */
  formatTotalTime(minutes: number): string {
    if (!minutes) return '0h'
    
    const hours = Math.floor(minutes / 60)
    const remainingMins = Math.floor(minutes % 60)
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    }
    
    return hours > 0 ? `${hours}h ${remainingMins}m` : `${remainingMins}m`
  }

  /**
   * Get GPX file content by ride ID
   */
  async getGpxData(rideId: number): Promise<string | null> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = 'SELECT gpx_data FROM rides WHERE id = ?'
      const result = await this.db.prepare(query).bind(rideId).first<{ gpx_data: any }>()
      
      if (result && result.gpx_data) {        
        // Handle different data types that might be returned from the database
        if (typeof result.gpx_data === 'string') {
          // Already a string, return as-is
          return result.gpx_data
        } else if (result.gpx_data instanceof Uint8Array) {
          // Uint8Array, decode to string
          return new TextDecoder().decode(result.gpx_data)
        } else if (Array.isArray(result.gpx_data)) {
          // Array of bytes, convert to Uint8Array first
          return new TextDecoder().decode(new Uint8Array(result.gpx_data))
        } else if (result.gpx_data instanceof ArrayBuffer) {
          // ArrayBuffer, convert to Uint8Array first
          return new TextDecoder().decode(new Uint8Array(result.gpx_data))
        } else {
          this.log.error('Unknown GPX data type:', typeof result.gpx_data, result.gpx_data)
          return null
        }
      }
      
      return null
    } catch (error) {
      this.log.error('Error getting GPX data:', error)
      throw error
    }
  }

  // ============= Database Management Functions =============

  /**
   * Get data from a specific table
   */
  async getTableData(tableName: string): Promise<{ rows: any; columns: any }> {
    if (!this.isInitialized) await this.initialize()

    if (!this.validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`)
    }
    
    try {
      const query = `SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`;
      const rawRows = (await this.db.prepare(query).all()).results || [];
      
      // Process rows to handle GPX data field specially
      const rows = rawRows.map(row => {
        if (tableName === 'rides' && row.gpx_data) {
          // Replace GPX data with an icon indicator
          const processedRow = { ...row }
          processedRow.gpx_data = '<i class="fas fa-file-code text-primary" title="GPX data available"></i>'
          return processedRow
        }
        return row
      })
      
      // Get column information
      const columns = (await this.db.prepare(`PRAGMA table_info(${tableName})`).all()).results || [];
      const columnNames = columns.map((col: any) => col.name);
      return { rows, columns: columnNames }; 
    } catch (error) {
      console.error('Error getting table data:', error.message);
      throw error;
    }
  }

  /**
   * Update a record in a table
   */
  async updateRecord(tableName: string, recordId: string | number, updateData: Record<string, any>): Promise<{ changes: number }> {
    if (!this.isInitialized) await this.initialize()
    
    if (!this.validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`)
    }
    
    try {
      // Build the UPDATE query dynamically
      const fields = Object.keys(updateData)
      if (fields.length === 0) {
        throw new Error('No fields to update')
      }
      
      const setClause = fields.map(field => `${field} = ?`).join(', ')
      const values = fields.map(field => updateData[field])
      values.push(recordId) // Add ID for WHERE clause
      
      const query = `UPDATE ${tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      const result = await this.db.prepare(query).bind(...values).run()
      
      if (result.success) {
        this.log.info(`Updated record ${recordId} in ${tableName}`)
        return { changes: result.meta.changes || 0 }
      } else {
        throw new Error('Failed to update record')
      }
    } catch (error) {
      this.log.error(`Error updating record in table ${tableName}:`, error)
      throw error
    }
  }

  /**
   * Delete a record from a table
   */
  async deleteRecord(tableName: string, recordId: string | number): Promise<{ changes: number }> {
    if (!this.isInitialized) await this.initialize()
    
    if (!this.validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`)
    }
    
    try {
      const query = `DELETE FROM ${tableName} WHERE id = ?`
      const result = await this.db.prepare(query).bind(recordId).run()
      
      if (result.success) {
        this.log.info(`Deleted record ${recordId} from ${tableName}`)
        return { changes: result.meta.changes || 0 }
      } else {
        throw new Error('Failed to delete record')
      }
    } catch (error) {
      this.log.error(`Error deleting record from table ${tableName}:`, error)
      throw error
    }
  }

  /**
   * Execute a custom SQL query (READ-ONLY for safety)
   */
  async executeQuery(query: string): Promise<any> {
    if (!this.isInitialized) await this.initialize()
    
    // Basic safety check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase()
    if (!trimmedQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for security reasons')
    }
    
    try {
      const result = await this.db.prepare(query).all()
      return {
        success: true,
        results: result.results || [],
        rowCount: (result.results || []).length
      }
    } catch (error) {
      this.log.error('Error executing custom query:', error)
      throw error
    }
  }

  /**
   * Export table data to CSV format
   */
  async exportTableToCsv(tableName: string): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    
    if (!this.validTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`)
    }
    
    try {
      const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC`
      const result = await this.db.prepare(query).all()
      const rows = result.results || []
      
      if (rows.length === 0) {
        return 'No data found'
      }
      
      // Get column headers
      const headers = Object.keys(rows[0])
      
      // Create CSV content
      const csvRows = []
      csvRows.push(headers.join(',')) // Header row
      
      rows.forEach((row: any) => {
        const values = headers.map(header => {
          const value = row[header]
          // Escape CSV values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value || ''
        })
        csvRows.push(values.join(','))
      })
      
      this.log.info(`Exported ${rows.length} rows from ${tableName} to CSV`)
      return csvRows.join('\n')
    } catch (error) {
      this.log.error(`Error exporting table ${tableName} to CSV:`, error)
      throw error
    }
  }

  /**
   * Clean up orphaned records (calorie_breakdown records without parent rides)
   */
  async cleanupOrphanedRecords(): Promise<{ changes: number }> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        DELETE FROM calorie_breakdown 
        WHERE ride_id NOT IN (SELECT id FROM rides)
      `
      
      const result = await this.db.prepare(query).run()
      
      if (result.success) {
        this.log.info(`Cleaned up ${result.meta.changes || 0} orphaned records`)
        return { changes: result.meta.changes || 0 }
      } else {
        throw new Error('Failed to cleanup orphaned records')
      }
    } catch (error) {
      this.log.error('Error cleaning up orphaned records:', error)
      throw error
    }
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Run VACUUM to reclaim space and defragment
      await this.db.exec('VACUUM')
      
      // Analyze tables to update statistics
      await this.db.exec('ANALYZE')
      
      // Reindex to improve query performance
      await this.db.exec('REINDEX')
      
      this.log.info('Database optimization completed')
    } catch (error) {
      this.log.error('Error optimizing database:', error)
      throw error
    }
  }

  /**
   * Create database backup (returns JSON data in Workers environment)
   */
  async createBackup(): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Export all data as JSON (since we can't create files in Workers)
      const exportData = await this.exportToJSON()
      
      this.log.info('Database backup created as JSON data')
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      this.log.error('Error creating database backup:', error)
      throw error
    }
  }

  /**
   * Get database information and statistics
   */
  async getDatabaseInfo(): Promise<any> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Get table counts
      const ridesCount = await this.db.prepare('SELECT COUNT(*) as count FROM rides').first()
      const breakdownCount = await this.db.prepare('SELECT COUNT(*) as count FROM calorie_breakdown').first()
      const configCount = await this.db.prepare('SELECT COUNT(*) as count FROM configuration').first()
      
      const tableInfo = [];
      tableInfo.push({ name: 'rides', count: (ridesCount as any)?.count || 0 });
      tableInfo.push({ name: 'calorie_breakdown', count: (breakdownCount as any)?.count || 0 });
      tableInfo.push({ name: 'configuration', count: (configCount as any)?.count || 0 });
      // Get database size information (limited in D1)
      const info = {
        type: 'Cloudflare D1 Database',
        tables: tableInfo,
        totalRecords: ((ridesCount as any)?.count || 0) + ((breakdownCount as any)?.count || 0) + ((configCount as any)?.count || 0),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      }
      
      this.log.info('Retrieved database information')
      return info
    } catch (error) {
      this.log.error('Error getting database info:', error  )
      throw error
    }
  }
}

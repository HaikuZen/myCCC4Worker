#!/usr/bin/env node

const DatabaseService = require('./lib/database-service');

async function testDatabaseConnection() {
    console.log('🧪 Testing database connection...');
    
    const dbService = new DatabaseService();
    
    try {
        // Initialize database
        await dbService.initialize();
        console.log('✅ Database initialized successfully');
        
        // Get global statistics
        const stats = await dbService.getGlobalStatistics();
        console.log('📊 Global statistics:', JSON.stringify(stats, null, 2));
        
        // Get recent rides
        const rides = await dbService.getRecentRides(5);
        console.log('🚴‍♂️ Recent rides:', JSON.stringify(rides, null, 2));
        
        // Get chart data
        const chartData = await dbService.getChartData(30);
        console.log('📈 Chart data:', JSON.stringify(chartData, null, 2));
        
        // Close connection
        await dbService.close();
        
        console.log('✅ All database operations completed successfully!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testDatabaseConnection();
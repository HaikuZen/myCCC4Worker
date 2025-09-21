#!/usr/bin/env node

const GPXParser = require('./gpx-parser');
const fs = require('fs');

async function testGPXStructure() {
    console.log('🧪 Testing GPX Parser Structure Consistency\n');
    
    // Check if there are any GPX files in the current directory
    const files = fs.readdirSync('.').filter(f => f.endsWith('.gpx'));
    
    if (files.length === 0) {
        console.log('❌ No GPX files found in current directory');
        console.log('Please add a sample GPX file to test the structure');
        return;
    }
    
    const testFile = files[0];
    console.log(`📁 Testing with file: ${testFile}`);
    
    try {
        const parser = new GPXParser();
        const result = await parser.parse(testFile);
        
        console.log('\n📊 GPX Parser Output Structure:');
        console.log('=====================================');
        console.log('Keys at root level:', Object.keys(result));
        
        if (result.summary) {
            console.log('\n📈 Summary structure:');
            console.log('Keys:', Object.keys(result.summary));
            console.log('Distance:', result.summary.distance, 'km');
            console.log('Total Time:', result.summary.totalTime, 'seconds');
            console.log('Moving Time:', result.summary.movingTime, 'seconds');
            console.log('Avg Speed:', result.summary.avgSpeed, 'km/h');
            console.log('Elevation Gain:', result.summary.elevationGain, 'm');
            console.log('elevation Loss:', result.summary.elevationLoss, 'm');
            console.log('Start Time:', result.summary.startTime);
        }
        
        if (result.analysis && result.analysis.caloriesBurned) {
            console.log('\n🔥 Calorie Analysis:');
            console.log('Estimated:', result.analysis.caloriesBurned.estimated);
            console.log('Method:', result.analysis.caloriesBurned.method);
            if (result.analysis.caloriesBurned.breakdown) {
                console.log('Breakdown keys:', Object.keys(result.analysis.caloriesBurned.breakdown));
            }
        }
        
        if (result.points && result.points.length > 0) {
            console.log('\n📍 Points structure:');
            console.log('Total points:', result.points.length);
            console.log('First point keys:', Object.keys(result.points[0]));
            console.log('First point:', {
                lat: result.points[0].lat,
                lon: result.points[0].lon,
                elevation: result.points[0].elevation,
                time: result.points[0].time
            });
        }
        
        console.log('\n🏃 Speed Calculations:');
        console.log('Distance:', result.summary.distance, 'km');
        console.log('Total Time:', result.summary.totalTime, 'seconds');
        console.log('Moving Time:', result.summary.movingTime, 'seconds');
        console.log('Average Speed:', result.summary.avgSpeed.toFixed(2), 'km/h');
        console.log('Max Speed:', result.summary.maxSpeed.toFixed(2), 'km/h');
        
        // Manual verification of average speed calculation
        const manualAvgSpeed = result.summary.movingTime > 0 ? 
            (result.summary.distance * 3600) / result.summary.movingTime : 0;
        console.log('Manual avg speed check:', manualAvgSpeed.toFixed(2), 'km/h');
        
        if (Math.abs(result.summary.avgSpeed - manualAvgSpeed) < 0.01) {
            console.log('✅ Average speed calculation is correct');
        } else {
            console.log('❌ Average speed calculation mismatch!');
        }
        
        console.log('\n✅ Structure test completed successfully');
        
        // Test the transformation that would be used for duplicate checking
        console.log('\n🔄 Testing duplicate check transformation:');
        const gpxDataForCheck = {
            distance: result.summary.distance,
            duration: result.summary.totalTime / 60, // Convert seconds to minutes
            startTime: result.summary.startTime
        };
        console.log('Transformed data:', gpxDataForCheck);
        
        // Test the transformation that would be used for database saving
        console.log('\n💾 Testing database save transformation:');
        const dbTransform = {
            gpxData: {
                distance: result.summary.distance,
                duration: result.summary.totalTime / 60, // Convert to minutes
                elevationGain: result.summary.elevationGain,
                averageSpeed: result.summary.avgSpeed,
                startTime: result.summary.startTime,
                elevationEnhanced: false,
                hasElevation: result.summary.elevationGain > 0
            },
            summary: {
                totalCalories: result.analysis.caloriesBurned.estimated,
                baseCalories: result.analysis.caloriesBurned.breakdown.base || 0,
                elevationCalories: result.analysis.caloriesBurned.breakdown.elevation || 0,
            }
        };
        console.log('Database transform preview:', JSON.stringify(dbTransform, null, 2));
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run if called directly
if (require.main === module) {
    testGPXStructure();
} else {
    module.exports = testGPXStructure;
}
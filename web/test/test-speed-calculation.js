#!/usr/bin/env node

const GPXParser = require('./lib/gpx-parser');

function testSpeedCalculation() {
    console.log('🧪 Testing Speed Calculation Formula\n');
    
    // Manual test with known values
    console.log('📐 Manual Test:');
    console.log('================');
    
    // Test case: 1 km in 3600 seconds (1 hour) should = 1 km/h
    const distance_km = 1;
    const time_seconds = 3600;
    
    const speed_correct = (distance_km * 3600) / time_seconds;
    const speed_incorrect = (distance_km * 3.6) / time_seconds;
    
    console.log(`Distance: ${distance_km} km`);
    console.log(`Time: ${time_seconds} seconds (${time_seconds/3600} hours)`);
    console.log(`Expected speed: 1 km/h`);
    console.log(`Correct formula (distance * 3600 / time): ${speed_correct} km/h ✅`);
    console.log(`Incorrect formula (distance * 3.6 / time): ${speed_incorrect} km/h ❌`);
    
    console.log('\n📐 Another Test Case:');
    console.log('=====================');
    
    // Test case: 10 km in 1800 seconds (30 minutes) should = 20 km/h
    const distance2_km = 10;
    const time2_seconds = 1800; // 30 minutes
    
    const speed2_correct = (distance2_km * 3600) / time2_seconds;
    const speed2_incorrect = (distance2_km * 3.6) / time2_seconds;
    
    console.log(`Distance: ${distance2_km} km`);
    console.log(`Time: ${time2_seconds} seconds (${time2_seconds/3600} hours)`);
    console.log(`Expected speed: 20 km/h`);
    console.log(`Correct formula (distance * 3600 / time): ${speed2_correct} km/h ✅`);
    console.log(`Incorrect formula (distance * 3.6 / time): ${speed2_incorrect} km/h ❌`);
    
    console.log('\n📝 Formula Explanation:');
    console.log('=======================');
    console.log('To convert km/s to km/h:');
    console.log('• Distance in km ÷ Time in hours = Speed in km/h');
    console.log('• Time in hours = Time in seconds ÷ 3600');
    console.log('• So: Distance ÷ (Time ÷ 3600) = (Distance × 3600) ÷ Time');
    console.log('• NOT: Distance × 3.6 ÷ Time (this would be incorrect)');
    
    console.log('\n🔍 Why 3.6 was wrong:');
    console.log('• 3.6 converts m/s to km/h (1 m/s = 3.6 km/h)');
    console.log('• But our distance is already in km, not meters');
    console.log('• So we need 3600 (seconds per hour), not 3.6');
}

function testAverageSpeedMethods() {
    console.log('\n📊 Average Speed Calculation Methods:');
    console.log('====================================');
    
    // Mock data for testing
    const segments = [
        { distance: 1, time: 300, speed: (1 * 3600) / 300 },    // 12 km/h
        { distance: 2, time: 400, speed: (2 * 3600) / 400 },    // 18 km/h  
        { distance: 1.5, time: 200, speed: (1.5 * 3600) / 200 } // 27 km/h
    ];
    
    console.log('Segment data:');
    segments.forEach((seg, i) => {
        console.log(`  Segment ${i+1}: ${seg.distance}km in ${seg.time}s = ${seg.speed.toFixed(1)} km/h`);
    });
    
    // Method 1: Average of segment speeds (less accurate)
    const avgFromSegments = segments.reduce((sum, seg) => sum + seg.speed, 0) / segments.length;
    
    // Method 2: Total distance / total time (more accurate)
    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
    const totalTime = segments.reduce((sum, seg) => sum + seg.time, 0);
    const avgFromTotal = (totalDistance * 3600) / totalTime;
    
    console.log(`\nTotal distance: ${totalDistance} km`);
    console.log(`Total time: ${totalTime} seconds (${(totalTime/3600).toFixed(2)} hours)`);
    console.log(`\nMethod 1 - Average of segment speeds: ${avgFromSegments.toFixed(2)} km/h`);
    console.log(`Method 2 - Total distance/time: ${avgFromTotal.toFixed(2)} km/h ✅ (More accurate)`);
    
    console.log('\n💡 Method 2 is more accurate because:');
    console.log('• Longer segments have more weight in the calculation');
    console.log('• Represents the actual overall speed of the journey');
    console.log('• Method 1 treats all segments equally regardless of length');
}

// Run tests
if (require.main === module) {
    testSpeedCalculation();
    testAverageSpeedMethods();
    console.log('\n✅ Speed calculation tests completed!');
}

module.exports = { testSpeedCalculation, testAverageSpeedMethods };
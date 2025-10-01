const fs = require('fs').promises;
const xml2js = require('xml2js');

/**
 * Comprehensive GPX Parser for Cycling Analytics
 * Extracts detailed cycling data from GPX files including elevation, speed, and timing
 * 
 * Features:
 * - Improved elevation gain calculation with GPS noise filtering
 * - Realistic speed limits (1-70 km/h) for cycling analysis
 * - Time-based filtering to remove GPS accuracy issues
 * - Distance validation to eliminate GPS drift
 * - Accurate average and maximum speed calculations
 */
class GPXParser {
    constructor() {
        this.parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            attrkey: 'attr'
        });
    }

    /**
     * Parse GPX file and extract cycling data
     * @param {string|Buffer} gpxData - GPX file path or buffer
     * @returns {Promise<Object>} Parsed cycling data
     */
    async parse(gpxData) {
        try {
            let xmlContent;
            
            // Handle file path or buffer input
            if (typeof gpxData === 'string') {
                xmlContent = await fs.readFile(gpxData, 'utf8');
            } else if (Buffer.isBuffer(gpxData)) {
                xmlContent = gpxData.toString('utf8');
            } else {
                xmlContent = gpxData;
            }

            const result = await this.parser.parseStringPromise(xmlContent);
            return this.extractCyclingData(result);
        } catch (error) {
            throw new Error(`GPX parsing failed: ${error.message}`);
        }
    }

    /**
     * Extract comprehensive cycling data from parsed GPX
     * @private
     */
    extractCyclingData(gpxData) {
        const tracks = this.extractTracks(gpxData);
        if (tracks.length === 0) {
            throw new Error('No track data found in GPX file');
        }

        const allPoints = tracks.reduce((acc, track) => acc.concat(track.points), []);
        
        return {
            metadata: this.extractMetadata(gpxData),
            summary: this.calculateSummary(allPoints),
            tracks: tracks,
            points: allPoints,
            analysis: this.performDetailedAnalysis(allPoints),
            segments: this.identifySegments(allPoints)
        };
    }

    /**
     * Extract metadata from GPX file
     * @private
     */
    extractMetadata(gpxData) {
        const metadata = gpxData.gpx?.metadata || {};
        return {
            name: metadata.name || 'Unnamed Track',
            description: metadata.desc || '',
            author: metadata.author?.name || 'Unknown',
            time: metadata.time ? new Date(metadata.time) : null,
            bounds: metadata.bounds ? {
                minLat: parseFloat(metadata.bounds.attr?.minlat || 0),
                maxLat: parseFloat(metadata.bounds.attr?.maxlat || 0),
                minLon: parseFloat(metadata.bounds.attr?.minlon || 0),
                maxLon: parseFloat(metadata.bounds.attr?.maxlon || 0)
            } : null
        };
    }

    /**
     * Extract track segments and points
     * @private
     */
    extractTracks(gpxData) {
        const gpxTracks = gpxData.gpx?.trk || [];
        const tracksArray = Array.isArray(gpxTracks) ? gpxTracks : [gpxTracks];
        
        return tracksArray.map((track, trackIndex) => {
            const segments = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg];
            const points = [];
            
            segments.forEach((segment, segIndex) => {
                if (segment?.trkpt) {
                    const segmentPoints = Array.isArray(segment.trkpt) ? segment.trkpt : [segment.trkpt];
                    
                    segmentPoints.forEach((point, pointIndex) => {
                        const trackPoint = this.parseTrackPoint(point, trackIndex, segIndex, pointIndex);
                        if (trackPoint) points.push(trackPoint);
                    });
                }
            });
            
            return {
                name: track.name || `Track ${trackIndex + 1}`,
                points: points,
                segmentCount: segments.length
            };
        });
    }

    /**
     * Parse individual track point with extensions
     * @private
     */
    parseTrackPoint(point, trackIndex, segmentIndex, pointIndex) {
        const lat = parseFloat(point.attr?.lat);
        const lon = parseFloat(point.attr?.lon);
        
        if (isNaN(lat) || isNaN(lon)) return null;

        const trackPoint = {
            lat,
            lon,
            elevation: point.ele ? parseFloat(point.ele) : null,
            time: point.time ? new Date(point.time) : null,
            trackIndex,
            segmentIndex,
            pointIndex
        };

        // Extract extensions (heart rate, cadence, power, etc.)
        if (point.extensions) {
            trackPoint.extensions = this.parseExtensions(point.extensions);
        }

        return trackPoint;
    }

    /**
     * Parse GPX extensions for additional data
     * @private
     */
    parseExtensions(extensions) {
        const parsed = {};
        
        // Handle different extension formats
        if (extensions.TrackPointExtension || extensions.tpe) {
            const tpe = extensions.TrackPointExtension || extensions.tpe;
            parsed.heartRate = tpe.hr ? parseInt(tpe.hr) : null;
            parsed.cadence = tpe.cad ? parseInt(tpe.cad) : null;
            parsed.speed = tpe.speed ? parseFloat(tpe.speed) : null;
            parsed.power = tpe.power ? parseFloat(tpe.power) : null;
            parsed.temperature = tpe.atemp ? parseFloat(tpe.atemp) : null;
        }

        // Handle Garmin extensions
        if (extensions['gpxtpx:TrackPointExtension']) {
            const garmin = extensions['gpxtpx:TrackPointExtension'];
            parsed.heartRate = garmin['gpxtpx:hr'] ? parseInt(garmin['gpxtpx:hr']) : null;
            parsed.cadence = garmin['gpxtpx:cad'] ? parseInt(garmin['gpxtpx:cad']) : null;
            parsed.speed = garmin['gpxtpx:speed'] ? parseFloat(garmin['gpxtpx:speed']) : null;
            parsed.power = garmin['gpxtpx:power'] ? parseFloat(garmin['gpxtpx:power']) : null;
        }

        return parsed;
    }

        /**
     * Calculate elevation gain with improved GPS noise filtering
     * Implements sophisticated filtering to provide accurate elevation metrics
     * @param {Array} points - Array of GPS track points with elevation data
     * @returns {Object} Elevation analysis with gain, loss, and filtering stats
     */
    calculateElevationGainImproved(points) {
        if (!points || points.length < 2) {
            return {
                elevationGain: 0,
                elevationLoss: 0,
                maxElevation: null,
                minElevation: null,
                validSegments: 0,
                filteredSegments: 0,
                filteringEfficiency: 0
            };
        }

        const validPoints = points.filter(p => p.lat && p.lon && p.elevation !== null);
        
        if (validPoints.length < 2) {
            return {
                elevationGain: 0,
                elevationLoss: 0,
                maxElevation: validPoints.length > 0 ? validPoints[0].elevation : null,
                minElevation: validPoints.length > 0 ? validPoints[0].elevation : null,
                validSegments: 0,
                filteredSegments: 0,
                filteringEfficiency: 0
            };
        }

        let totalElevationGain = 0;
        let totalElevationLoss = 0;
        let maxElevation = validPoints[0].elevation;
        let minElevation = validPoints[0].elevation;
        let validSegments = 0;
        let filteredSegments = 0;

        // Apply multi-layer filtering for GPS noise reduction
        for (let i = 1; i < validPoints.length; i++) {
            const prev = validPoints[i - 1];
            const curr = validPoints[i];

            // Layer 1: Time-based filtering
            let timeFiltered = false;
            if (prev.time && curr.time) {
                const timeDiff = (curr.time - prev.time) / 1000; // seconds
                
                // Filter out segments with unrealistic time intervals
                if (timeDiff < 2 || timeDiff > 300) {
                    filteredSegments++;
                    timeFiltered = true;
                    continue;
                }
            }

            // Layer 2: Distance-based filtering (if we have coordinates)
            let distanceFiltered = false;
            if (!timeFiltered && prev.lat && prev.lon && curr.lat && curr.lon) {
                const distance = this.calculateDistance(prev, curr);
                
                // Filter out segments with very small distances (GPS drift)
                if (distance < 0.002) { // 2 meters minimum
                    filteredSegments++;
                    distanceFiltered = true;
                    continue;
                }
                
                // Layer 3: Speed-based filtering (if we have time data)
                if (prev.time && curr.time) {
                    const timeDiff = (curr.time - prev.time) / 1000;
                    const speed = (distance * 3600) / timeDiff; // km/h
                    
                    // Filter out unrealistic speeds that indicate GPS errors
                    if (speed < 1 || speed > 70) {
                        filteredSegments++;
                        continue;
                    }
                }
            }

            // Calculate elevation change for valid segments
            const elevationChange = curr.elevation - prev.elevation;
            
            // Layer 4: Elevation change validation
            // Filter out extreme elevation changes that are likely GPS errors
            const absoluteChange = Math.abs(elevationChange);
            if (absoluteChange > 50) { // More than 50m change in one segment is suspicious
                filteredSegments++;
                continue;
            }

            // Valid segment - process elevation change
            validSegments++;
            
            if (elevationChange > 0) {
                totalElevationGain += elevationChange;
            } else {
                totalElevationLoss += absoluteChange;
            }

            // Track elevation extremes
            maxElevation = Math.max(maxElevation, curr.elevation);
            minElevation = Math.min(minElevation, curr.elevation);
        }

        const totalSegments = validSegments + filteredSegments;
        const filteringEfficiency = totalSegments > 0 ? (filteredSegments / totalSegments) * 100 : 0;

        return {
            elevationGain: Math.round(totalElevationGain * 10) / 10, // Round to 1 decimal place
            elevationLoss: Math.round(totalElevationLoss * 10) / 10,
            maxElevation: maxElevation,
            minElevation: minElevation,
            validSegments: validSegments,
            filteredSegments: filteredSegments,
            filteringEfficiency: Math.round(filteringEfficiency * 10) / 10,
            elevationRange: maxElevation - minElevation,
            // Additional quality metrics
            qualityMetrics: {
                dataPoints: validPoints.length,
                elevationDataCoverage: validPoints.length / points.length * 100,
                averageElevation: validPoints.reduce((sum, p) => sum + p.elevation, 0) / validPoints.length
            }
        };
    }

    /**
     * Calculate comprehensive ride summary with improved GPS noise filtering
     * @private
     */
    calculateSummary(points) {
        if (points.length < 2) {
            return { error: 'Insufficient data points for analysis' };
        }

        const validPoints = points.filter(p => p.lat && p.lon);
        
        // Use improved elevation calculation method
        const elevationAnalysis = this.calculateElevationGainImproved(points);
        
        let totalDistance = 0;
        let movingTime = 0;
        let maxSpeed = 0;

        const speeds = [];
        const elevations = [];
        const timestamps = [];

        for (let i = 1; i < validPoints.length; i++) {
            const prev = validPoints[i - 1];
            const curr = validPoints[i];

            // Calculate distance segment
            const segmentDistance = this.calculateDistance(prev, curr);
            totalDistance += segmentDistance;

            // Collect elevation data for additional analysis (already calculated in elevationAnalysis)
            if (curr.elevation !== null) {
                elevations.push(curr.elevation);
            }

            // Calculate speed and time with improved filtering for GPS noise
            if (prev.time && curr.time) {
                const timeDiff = (curr.time - prev.time) / 1000; // seconds
                
                // Skip if time difference is too small (GPS noise) or too large (stopped)
                if (timeDiff < 2 || timeDiff > 300) {
                    continue;
                }
                
                // Calculate speed: distance (km) / time (hours) = km/h
                const speed = (segmentDistance * 3600) / timeDiff;
                
                // More realistic speed filtering for cycling:
                // - Minimum 1 km/h (to exclude near-stationary points)
                // - Maximum 70 km/h (reasonable for cycling, including downhills)
                // - Filter out segments with very small distances (GPS noise)
                if (speed >= 1 && speed <= 70 && segmentDistance >= 0.002) { // 0.002 km = 2 meters minimum
                    speeds.push(speed);
                    maxSpeed = Math.max(maxSpeed, speed);
                    movingTime += timeDiff;
                }
                
                timestamps.push(curr.time);
            }
        }

        const totalTime = validPoints.length > 0 && validPoints[0].time && validPoints[validPoints.length - 1].time
            ? (validPoints[validPoints.length - 1].time - validPoints[0].time) / 1000
            : movingTime;

        // Calculate average speed using total distance and moving time for more accuracy
        const avgSpeedFromTotal = movingTime > 0 ? (totalDistance * 3600) / movingTime : 0;
        // Also calculate weighted average of segment speeds for comparison
        const avgSpeedFromSegments = speeds.length > 0 ? speeds.reduce((a, b) => a + b) / speeds.length : 0;
        
        // Use total distance/time method as it's more accurate for average speed
        const finalAvgSpeed = avgSpeedFromTotal > 0 ? avgSpeedFromTotal : avgSpeedFromSegments;
        
        return {
            distance: totalDistance, // km
            totalTime: totalTime, // seconds
            movingTime: movingTime, // seconds
            avgSpeed: finalAvgSpeed, // km/h (using total distance / moving time)
            maxSpeed: maxSpeed, // km/h
            // Use improved elevation calculations
            elevationGain: elevationAnalysis.elevationGain, // meters (filtered)
            elevationLoss: elevationAnalysis.elevationLoss, // meters (filtered)
            maxElevation: elevationAnalysis.maxElevation, // meters
            minElevation: elevationAnalysis.minElevation, // meters
            elevationRange: elevationAnalysis.elevationRange, // meters
            // Extension data
            averageHeartRate: this.calculateAverageExtension(validPoints, 'heartRate'),
            maxHeartRate: this.calculateMaxExtension(validPoints, 'heartRate'),
            averageCadence: this.calculateAverageExtension(validPoints, 'cadence'),
            averagePower: this.calculateAverageExtension(validPoints, 'power'),
            // Metadata
            pointCount: validPoints.length,
            startTime: validPoints[0]?.time,
            endTime: validPoints[validPoints.length - 1]?.time,
            // Quality metrics from improved elevation calculation
            elevationQuality: {
                validSegments: elevationAnalysis.validSegments,
                filteredSegments: elevationAnalysis.filteredSegments,
                filteringEfficiency: elevationAnalysis.filteringEfficiency,
                elevationDataCoverage: elevationAnalysis.qualityMetrics.elevationDataCoverage
            }
        };
    }

    /**
     * Perform detailed analysis on the ride data
     * @private
     */
    performDetailedAnalysis(points) {
        const analysis = {
            speedZones: this.analyzeSpeedZones(points),
            elevationProfile: this.generateElevationProfile(points),
            heartRateZones: this.analyzeHeartRateZones(points),
            powerZones: this.analyzePowerZones(points),
            intensityMetrics: this.calculateIntensityMetrics(points)
        };

        // Calculate calories burned
        analysis.caloriesBurned = this.estimateCalories(points, analysis);

        return analysis;
    }

    /**
     * Identify ride segments (climbs, descents, flats)
     * @private
     */
    identifySegments(points) {
        const segments = [];
        let currentSegment = null;
        const elevationThreshold = 10; // meters
        const gradientThreshold = 0.03; // 3% grade

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];

            if (!prev.elevation || !curr.elevation) continue;

            const distance = this.calculateDistance(prev, curr) * 1000; // meters
            const elevationChange = curr.elevation - prev.elevation;
            const gradient = distance > 0 ? elevationChange / distance : 0;

            let segmentType = 'flat';
            if (gradient > gradientThreshold) segmentType = 'climb';
            else if (gradient < -gradientThreshold) segmentType = 'descent';

            if (!currentSegment || currentSegment.type !== segmentType) {
                if (currentSegment) segments.push(currentSegment);
                currentSegment = {
                    type: segmentType,
                    startIndex: i - 1,
                    endIndex: i,
                    distance: 0,
                    elevationChange: 0,
                    avgGradient: 0,
                    maxGradient: gradient
                };
            }

            currentSegment.endIndex = i;
            currentSegment.distance += distance;
            currentSegment.elevationChange += elevationChange;
            currentSegment.maxGradient = Math.max(currentSegment.maxGradient, Math.abs(gradient));
        }

        if (currentSegment) segments.push(currentSegment);

        return segments.map(segment => ({
            ...segment,
            avgGradient: segment.distance > 0 ? segment.elevationChange / segment.distance : 0,
            distance: segment.distance / 1000 // convert back to km
        }));
    }

    /**
     * Calculate distance between two GPS points using Haversine formula
     * @private
     */
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(point2.lat - point1.lat);
        const dLon = this.toRadians(point2.lon - point1.lon);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     * @private
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Calculate average value for extension data
     * @private
     */
    calculateAverageExtension(points, extensionKey) {
        const values = points
            .filter(p => p.extensions && p.extensions[extensionKey] !== null)
            .map(p => p.extensions[extensionKey]);
        return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : null;
    }

    /**
     * Calculate maximum value for extension data
     * @private
     */
    calculateMaxExtension(points, extensionKey) {
        const values = points
            .filter(p => p.extensions && p.extensions[extensionKey] !== null)
            .map(p => p.extensions[extensionKey]);
        return values.length > 0 ? Math.max(...values) : null;
    }

    /**
     * Analyze speed zones distribution
     * @private
     */
    analyzeSpeedZones(points) {
        const zones = {
            'Recovery (0-15 km/h)': 0,
            'Endurance (15-25 km/h)': 0,
            'Tempo (25-35 km/h)': 0,
            'Threshold (35-45 km/h)': 0,
            'VO2 Max (45+ km/h)': 0
        };

        let totalPoints = 0;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];

            if (prev.time && curr.time) {
                const timeDiff = (curr.time - prev.time) / 1000;
                
                // Use same filtering as in calculateSummary
                if (timeDiff < 2 || timeDiff > 300) {
                    continue;
                }
                
                const distance = this.calculateDistance(prev, curr);
                const speed = (distance * 3600) / timeDiff;

                // Apply same realistic speed filtering
                if (speed >= 1 && speed <= 70 && distance >= 0.002) {
                    totalPoints++;
                    if (speed < 15) zones['Recovery (0-15 km/h)']++;
                    else if (speed < 25) zones['Endurance (15-25 km/h)']++;
                    else if (speed < 35) zones['Tempo (25-35 km/h)']++;
                    else if (speed < 45) zones['Threshold (35-45 km/h)']++;
                    else zones['VO2 Max (45+ km/h)']++;
                }
            }
        }

        // Convert to percentages
        Object.keys(zones).forEach(zone => {
            zones[zone] = totalPoints > 0 ? (zones[zone] / totalPoints) * 100 : 0;
        });

        return zones;
    }

    /**
     * Generate elevation profile data
     * @private
     */
    generateElevationProfile(points) {
        const profile = [];
        let cumulativeDistance = 0;

        for (let i = 0; i < points.length; i++) {
            if (i > 0) {
                cumulativeDistance += this.calculateDistance(points[i - 1], points[i]);
            }
            
            if (points[i].elevation !== null) {
                profile.push({
                    distance: cumulativeDistance,
                    elevation: points[i].elevation,
                    gradient: i > 0 ? this.calculateGradient(points[i - 1], points[i]) : 0
                });
            }
        }

        return profile;
    }

    /**
     * Calculate gradient between two points
     * @private
     */
    calculateGradient(point1, point2) {
        if (!point1.elevation || !point2.elevation) return 0;
        const distance = this.calculateDistance(point1, point2) * 1000; // convert to meters
        const elevationChange = point2.elevation - point1.elevation;
        return distance > 0 ? (elevationChange / distance) * 100 : 0; // percentage
    }

    /**
     * Analyze heart rate zones if available
     * @private
     */
    analyzeHeartRateZones(points) {
        const heartRates = points
            .filter(p => p.extensions && p.extensions.heartRate)
            .map(p => p.extensions.heartRate);

        if (heartRates.length === 0) return null;

        // Assuming max HR of 190 for zone calculation (should be configurable)
        const maxHR = 190;
        const zones = {
            'Zone 1 (50-60%)': 0,
            'Zone 2 (60-70%)': 0,
            'Zone 3 (70-80%)': 0,
            'Zone 4 (80-90%)': 0,
            'Zone 5 (90-100%)': 0
        };

        heartRates.forEach(hr => {
            const percentage = (hr / maxHR) * 100;
            if (percentage < 60) zones['Zone 1 (50-60%)']++;
            else if (percentage < 70) zones['Zone 2 (60-70%)']++;
            else if (percentage < 80) zones['Zone 3 (70-80%)']++;
            else if (percentage < 90) zones['Zone 4 (80-90%)']++;
            else zones['Zone 5 (90-100%)']++;
        });

        // Convert to percentages
        Object.keys(zones).forEach(zone => {
            zones[zone] = (zones[zone] / heartRates.length) * 100;
        });

        return zones;
    }

    /**
     * Analyze power zones if available
     * @private
     */
    analyzePowerZones(points) {
        const powerValues = points
            .filter(p => p.extensions && p.extensions.power && p.extensions.power > 0)
            .map(p => p.extensions.power);

        if (powerValues.length === 0) return null;

        // Calculate basic power statistics
        const avgPower = powerValues.reduce((a, b) => a + b) / powerValues.length;
        const maxPower = Math.max(...powerValues);
        
        return {
            average: avgPower,
            maximum: maxPower,
            normalizedPower: this.calculateNormalizedPower(powerValues)
        };
    }

    /**
     * Calculate normalized power (rolling 30-second average)
     * @private
     */
    calculateNormalizedPower(powerValues) {
        if (powerValues.length < 30) return null;
        
        const rollingAverages = [];
        for (let i = 0; i <= powerValues.length - 30; i++) {
            const segment = powerValues.slice(i, i + 30);
            const average = segment.reduce((a, b) => a + b) / segment.length;
            rollingAverages.push(Math.pow(average, 4));
        }
        
        const averageFourthPower = rollingAverages.reduce((a, b) => a + b) / rollingAverages.length;
        return Math.pow(averageFourthPower, 0.25);
    }

    /**
     * Calculate intensity metrics
     * @private
     */
    calculateIntensityMetrics(points) {
        const metrics = {
            variabilityIndex: null,
            intensityFactor: null,
            trainingStressScore: null
        };

        // Basic implementation - would need user's FTP for accurate calculations
        return metrics;
    }

    /**
     * Get improved elevation analysis for a set of points (public method)
     * @param {Array} points - Array of GPS track points with elevation data
     * @returns {Object} Detailed elevation analysis with filtering statistics
     */
    getElevationAnalysis(points) {
        return this.calculateElevationGainImproved(points);
    }

    /**
     * Estimate calories burned during the ride
     * @private
     */
    estimateCalories(points, analysis) {
        // Multiple estimation methods
        const summary = this.calculateSummary(points);
        
        // Method 1: Distance and elevation based
        const baseCalories = summary.distance * 40; // ~40 calories per km
        const elevationCalories = summary.elevationGain * 0.1; // Additional for climbing
        
        // Method 2: Heart rate based (if available)
        let hrCalories = null;
        if (analysis.heartRateZones) {
            // Simplified HR-based calculation
            hrCalories = summary.movingTime / 60 * 8; // ~8 cal/min average
        }
        
        // Method 3: Power based (if available)
        let powerCalories = null;
        if (analysis.powerZones && analysis.powerZones.average) {
            // Power-based: ~3.6 calories per kJ
            const kilojoules = analysis.powerZones.average * (summary.movingTime / 1000);
            powerCalories = kilojoules * 3.6;
        }
        
        // Use most accurate method available
        const estimated = powerCalories || hrCalories || (baseCalories + elevationCalories);
        
        return {
            estimated: Math.round(estimated),
            method: powerCalories ? 'power' : hrCalories ? 'heart_rate' : 'distance_elevation',
            breakdown: {
                base: Math.round(baseCalories),
                elevation: Math.round(elevationCalories),
                heartRate: hrCalories ? Math.round(hrCalories) : null,
                power: powerCalories ? Math.round(powerCalories) : null
            }
        };
    }
}

module.exports = GPXParser;
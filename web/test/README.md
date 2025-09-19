# Test Files Directory 🧪

This directory contains all test files for the Cycling Calories Calculator project. Each file serves a specific testing purpose during development and debugging.

## HTML Test Files 🌐

### `test-upload.html`
- **Purpose**: Tests GPX file upload functionality
- **Features**: File input, HTMX integration testing, upload validation
- **Usage**: Open in browser to test file upload without main app

### `test-duplicate-prevention.html` 
- **Purpose**: Tests duplicate file detection system
- **Features**: Upload same file multiple times, test filename/content-based detection
- **Usage**: Verify duplicate prevention works correctly

### `test-chart-data.html`
- **Purpose**: Tests chart data loading and dashboard API endpoints
- **Features**: Raw API data inspection, chart data structure validation
- **Usage**: Debug chart data issues and API responses

### `test-chart.html`
- **Purpose**: Tests Chart.js integration and rendering
- **Features**: Chart initialization, data visualization testing
- **Usage**: Isolate chart-related issues from main application

### `test-location-search.html`
- **Purpose**: Tests location search and geocoding functionality
- **Features**: OpenWeatherMap API integration, location input testing
- **Usage**: Test location search without full weather app context

## JavaScript Test Files 🔧

### `test-db-connection.js`
- **Purpose**: Database connectivity and operations testing
- **Features**: SQLite connection, CRUD operations, schema validation
- **Usage**: `node test/test-db-connection.js`

### `test-gpx-structure.js`
- **Purpose**: GPX file parsing and structure validation
- **Features**: XML parsing, data extraction, format validation
- **Usage**: `node test/test-gpx-structure.js <gpx-file>`

### `test-speed-calculation.js`
- **Purpose**: Speed and distance calculation algorithms
- **Features**: GPS coordinate calculations, speed algorithms testing
- **Usage**: `node test/test-speed-calculation.js`

### `test_config.js`
- **Purpose**: Configuration system testing
- **Features**: Database configuration CRUD, validation, defaults
- **Usage**: `node test/test_config.js`

### `test_new_args.js`
- **Purpose**: Command-line argument parsing testing
- **Features**: CLI interface, argument validation, help system
- **Usage**: `node test/test_new_args.js --help`

## How to Run Tests 🚀

### Prerequisites
```bash
# Ensure dependencies are installed
npm install

# Database should be initialized
node index-new.js --help
```

### Running HTML Tests
1. **Start the web server**: `node index-new.js --web`
2. **Open test files**: Navigate to `http://localhost:8000/test/filename.html`
3. **Or open directly**: Double-click HTML files to open in browser

### Running JavaScript Tests
```bash
# From project root directory
node test/test-db-connection.js
node test/test-gpx-structure.js sample.gpx
node test/test-speed-calculation.js
node test/test_config.js
node test/test_new_args.js
```

## Test Data 📊

Some tests may require sample data:
- **GPX files**: Place sample `.gpx` files in this directory for testing
- **Database**: Tests will create temporary databases or use existing ones
- **API keys**: Some tests may require OpenWeatherMap API key in configuration

## Development Notes 💡

### Adding New Tests
1. **Naming convention**: Use `test-feature-name.html` or `test-feature-name.js`
2. **Documentation**: Update this README with new test descriptions
3. **Dependencies**: Keep tests as self-contained as possible

### Test Categories
- **Unit Tests**: Individual function/module testing (`.js` files)
- **Integration Tests**: Component interaction testing (`.html` files)
- **API Tests**: External service integration testing
- **UI Tests**: User interface and interaction testing

### Best Practices
- **Isolation**: Each test should be independent
- **Cleanup**: Tests should clean up after themselves
- **Documentation**: Include usage instructions in test files
- **Error Handling**: Test both success and failure scenarios

## Troubleshooting 🔧

### Common Issues
1. **Database locked**: Stop any running instances of the main app
2. **Port conflicts**: Change port numbers in test files if needed
3. **Missing dependencies**: Run `npm install` from project root
4. **API limits**: Some tests may hit API rate limits

### Debug Mode
Most test files include console logging. Open browser DevTools or check terminal output for detailed information.

---

**Last Updated**: September 2025  
**Test Files Count**: 10  
**Coverage**: Upload, Database, Charts, Location Search, Configuration, CLI
const axios = require('axios');

// Test Yahoo Finance API connection
async function testYahooFinance() {
    console.log('\n🧪 Testing Yahoo Finance API...\n');
    
    const testSymbol = 'HDFCBANK';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${testSymbol}.NS`;
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });

        const result = response.data.chart.result[0];
        const meta = result.meta;

        console.log('✅ Yahoo Finance API - SUCCESS');
        console.log(`📊 ${testSymbol} Data:`);
        console.log(`   Current Price: ₹${meta.regularMarketPrice}`);
        console.log(`   Previous Close: ₹${meta.chartPreviousClose}`);
        console.log(`   Currency: ${meta.currency}`);
        console.log(`   Market State: ${meta.marketState}`);
        console.log('');
        return true;
    } catch (error) {
        console.log('❌ Yahoo Finance API - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test local server
async function testLocalServer() {
    console.log('🧪 Testing Local Server...\n');
    
    try {
        const response = await axios.get('http://localhost:3000/health', {
            timeout: 5000
        });

        if (response.data.status === 'ok') {
            console.log('✅ Local Server - RUNNING');
            console.log(`   Timestamp: ${response.data.timestamp}`);
            console.log('');
            return true;
        } else {
            console.log('⚠️ Local Server - UNEXPECTED RESPONSE');
            console.log('');
            return false;
        }
    } catch (error) {
        console.log('❌ Local Server - NOT RUNNING');
        console.log(`   Error: ${error.message}`);
        console.log('   💡 Start server with: npm start');
        console.log('');
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Bank Nifty Tracker - System Test    ║');
    console.log('╚════════════════════════════════════════╝');

    const yahooTest = await testYahooFinance();
    const serverTest = await testLocalServer();

    console.log('╔════════════════════════════════════════╗');
    console.log('║           Test Summary                 ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Yahoo Finance API: ${yahooTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Local Server:      ${serverTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (yahooTest && serverTest) {
        console.log('🎉 All tests passed! Your setup is ready.');
        console.log('🌐 Open http://localhost:3000 in your browser');
    } else {
        console.log('⚠️ Some tests failed. Check errors above.');
    }
}

runTests();

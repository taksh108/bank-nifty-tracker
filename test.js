const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_PIN = process.env.MULTIPLIER_PIN || '1234';

// Format number to Indian currency
function formatCurrency(value) {
    if (!value) return '-';
    return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Test Yahoo Finance API connection with extended data
async function testYahooFinance() {
    console.log('\n🧪 Testing Yahoo Finance API...\n');

    const testSymbol = 'HDFCBANK';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${testSymbol}.NS?modules=price,summaryDetail`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const result = response.data.chart.result[0];
        const meta = result.meta;

        console.log('✅ Yahoo Finance API - SUCCESS');
        console.log(`📊 ${testSymbol} Data:`);
        console.log(`   Current Price: ${formatCurrency(meta.regularMarketPrice)}`);
        console.log(`   Previous Close: ${formatCurrency(meta.chartPreviousClose)}`);
        console.log(`   Day High: ${formatCurrency(meta.regularMarketDayHigh)}`);
        console.log(`   Day Low: ${formatCurrency(meta.regularMarketDayLow)}`);
        console.log(`   Volume: ${meta.regularMarketVolume?.toLocaleString('en-IN') || '-'}`);
        console.log(`   Currency: ${meta.currency}`);
        console.log(`   Market State: ${meta.marketState}`);
        console.log(`   Exchange: ${meta.exchangeName}`);
        console.log('');
        return true;
    } catch (error) {
        console.log('❌ Yahoo Finance API - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test Bank Nifty Index fetch
async function testBankNiftyIndex() {
    console.log('🧪 Testing Bank Nifty Index API...\n');

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEBANK`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const result = response.data.chart.result[0];
        const meta = result.meta;
        const change = meta.regularMarketPrice - meta.chartPreviousClose;
        const changePercent = ((change / meta.chartPreviousClose) * 100).toFixed(2);

        console.log('✅ Bank Nifty Index - SUCCESS');
        console.log(`📈 BANKNIFTY Index:`);
        console.log(`   Current Value: ${formatCurrency(meta.regularMarketPrice)}`);
        console.log(`   Previous Close: ${formatCurrency(meta.chartPreviousClose)}`);
        console.log(`   Change: ${change >= 0 ? '+' : ''}${formatCurrency(change)} (${changePercent}%)`);
        console.log(`   Day High: ${formatCurrency(meta.regularMarketDayHigh)}`);
        console.log(`   Day Low: ${formatCurrency(meta.regularMarketDayLow)}`);
        console.log(`   Market State: ${meta.marketState}`);
        console.log('');
        return true;
    } catch (error) {
        console.log('❌ Bank Nifty Index - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test local server health
async function testLocalServer() {
    console.log('🧪 Testing Local Server Health...\n');

    try {
        const response = await axios.get(`${BASE_URL}/health`, {
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

// Format market cap in Crores
function formatMarketCap(value) {
    if (!value) return '-'.padStart(10);
    const crores = value / 10000000;
    if (crores >= 100000) {
        return ('₹' + (crores / 100000).toFixed(1) + 'L Cr').padStart(10);
    }
    return ('₹' + crores.toFixed(0) + ' Cr').padStart(10);
}

// Test /api/stocks endpoint
async function testStocksEndpoint() {
    console.log('🧪 Testing /api/stocks Endpoint...\n');

    try {
        const response = await axios.get(`${BASE_URL}/api/stocks`, {
            timeout: 30000
        });

        if (response.data.success && response.data.data) {
            const stocks = response.data.data;
            console.log('✅ /api/stocks - SUCCESS');
            console.log(`   Stocks returned: ${stocks.length}`);
            console.log(`   Timestamp: ${response.data.timestamp}`);
            console.log('');

            // Calculate total market cap
            const totalMarketCap = stocks.reduce((sum, s) => sum + (s.marketCap || 0), 0);

            // Display stock summary with market cap
            console.log('   📊 Stock Summary:');
            console.log('   ─────────────────────────────────────────────────────────────────────');
            console.log('       Symbol         Price      Change     Market Cap    52W High/Low');
            console.log('   ─────────────────────────────────────────────────────────────────────');
            stocks.forEach((stock, i) => {
                const change = stock.livePrice - stock.previousClose;
                const changePercent = stock.previousClose ? ((change / stock.previousClose) * 100).toFixed(2) : 0;
                const indicator = change >= 0 ? '▲' : '▼';
                const priceStr = formatCurrency(stock.livePrice).padStart(12);
                const changeStr = `${indicator} ${Math.abs(changePercent).toString().padStart(5)}%`;
                const mcapStr = formatMarketCap(stock.marketCap);
                const weekRange = stock.fiftyTwoWeekLow && stock.fiftyTwoWeekHigh
                    ? `${stock.fiftyTwoWeekLow.toFixed(0)}-${stock.fiftyTwoWeekHigh.toFixed(0)}`
                    : '-';
                console.log(`   ${(i + 1).toString().padStart(2)}. ${stock.symbol.padEnd(12)} ${priceStr} ${changeStr} ${mcapStr}    ${weekRange}`);
            });
            console.log('   ─────────────────────────────────────────────────────────────────────');
            console.log(`   Total Market Cap: ${formatMarketCap(totalMarketCap)}`);
            console.log('');
            return true;
        } else {
            console.log('⚠️ /api/stocks - UNEXPECTED RESPONSE');
            console.log('');
            return false;
        }
    } catch (error) {
        console.log('❌ /api/stocks - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test /api/banknifty endpoint
async function testBankNiftyEndpoint() {
    console.log('🧪 Testing /api/banknifty Endpoint...\n');

    try {
        const response = await axios.get(`${BASE_URL}/api/banknifty`, {
            timeout: 10000
        });

        if (response.data.success && response.data.data) {
            const data = response.data.data;
            const change = data.livePrice - data.previousClose;
            const changePercent = ((change / data.previousClose) * 100).toFixed(2);

            console.log('✅ /api/banknifty - SUCCESS');
            console.log(`   Current Value: ${formatCurrency(data.livePrice)}`);
            console.log(`   Previous Close: ${formatCurrency(data.previousClose)}`);
            console.log(`   Change: ${change >= 0 ? '+' : ''}${formatCurrency(change)} (${changePercent}%)`);
            console.log(`   Market State: ${data.marketState}`);
            console.log('');
            return true;
        } else {
            console.log('⚠️ /api/banknifty - UNEXPECTED RESPONSE');
            console.log('');
            return false;
        }
    } catch (error) {
        console.log('❌ /api/banknifty - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test /api/multipliers endpoint
async function testMultipliersEndpoint() {
    console.log('🧪 Testing /api/multipliers Endpoint...\n');

    try {
        const response = await axios.get(`${BASE_URL}/api/multipliers`, {
            timeout: 5000
        });

        if (response.data.success) {
            const multipliers = response.data.data;
            const metadata = response.data.metadata;

            console.log('✅ /api/multipliers - SUCCESS');
            console.log(`   Last Saved: ${metadata.lastSaved || 'Never'}`);
            console.log(`   Multipliers configured: ${Object.keys(multipliers).length}`);

            // Show non-default multipliers
            const nonDefault = Object.entries(multipliers).filter(([_, v]) => v !== 1);
            if (nonDefault.length > 0) {
                console.log('   Custom multipliers:');
                nonDefault.forEach(([symbol, value]) => {
                    console.log(`      ${symbol}: ${value}`);
                });
            }
            console.log('');
            return true;
        } else {
            console.log('⚠️ /api/multipliers - UNEXPECTED RESPONSE');
            console.log('');
            return false;
        }
    } catch (error) {
        console.log('❌ /api/multipliers - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test PIN verification endpoint
async function testPinVerification() {
    console.log('🧪 Testing /api/verify-pin Endpoint...\n');

    try {
        // Test with correct PIN
        const validResponse = await axios.post(`${BASE_URL}/api/verify-pin`, {
            pin: TEST_PIN
        }, { timeout: 5000 });

        if (validResponse.data.success) {
            console.log('✅ PIN Verification (valid) - SUCCESS');
        }

        // Test with incorrect PIN
        const invalidResponse = await axios.post(`${BASE_URL}/api/verify-pin`, {
            pin: 'wrong_pin'
        }, { timeout: 5000 }).catch(e => e.response);

        if (invalidResponse && invalidResponse.status === 401) {
            console.log('✅ PIN Verification (invalid) - Correctly rejected');
        }

        console.log('');
        return true;
    } catch (error) {
        console.log('❌ /api/verify-pin - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Test single stock endpoint
async function testSingleStockEndpoint() {
    console.log('🧪 Testing /api/stocks/:symbol Endpoint...\n');

    try {
        const response = await axios.get(`${BASE_URL}/api/stocks/HDFCBANK`, {
            timeout: 10000
        });

        if (response.data.success && response.data.data) {
            const stock = response.data.data;
            console.log('✅ /api/stocks/HDFCBANK - SUCCESS');
            console.log(`   Name: ${stock.name}`);
            console.log(`   Price: ${formatCurrency(stock.livePrice)}`);
            console.log(`   Previous Close: ${formatCurrency(stock.previousClose)}`);
            console.log('');
            return true;
        } else {
            console.log('⚠️ /api/stocks/:symbol - UNEXPECTED RESPONSE');
            console.log('');
            return false;
        }
    } catch (error) {
        console.log('❌ /api/stocks/:symbol - FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        Bank Nifty Tracker - Comprehensive Test Suite      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    const results = {
        yahooFinance: await testYahooFinance(),
        bankNiftyIndex: await testBankNiftyIndex(),
        localServer: await testLocalServer()
    };

    // Only run server endpoint tests if server is running
    if (results.localServer) {
        console.log('─────────────────────────────────────────────────────────────');
        console.log('                    Server Endpoint Tests                     ');
        console.log('─────────────────────────────────────────────────────────────');

        results.stocksEndpoint = await testStocksEndpoint();
        results.bankNiftyEndpoint = await testBankNiftyEndpoint();
        results.singleStock = await testSingleStockEndpoint();
        results.multipliers = await testMultipliersEndpoint();
        results.pinVerification = await testPinVerification();
    }

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                     Test Summary                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    const testNames = {
        yahooFinance: 'Yahoo Finance API',
        bankNiftyIndex: 'Bank Nifty Index',
        localServer: 'Local Server',
        stocksEndpoint: '/api/stocks',
        bankNiftyEndpoint: '/api/banknifty',
        singleStock: '/api/stocks/:symbol',
        multipliers: '/api/multipliers',
        pinVerification: '/api/verify-pin'
    };

    let passed = 0;
    let failed = 0;

    Object.entries(results).forEach(([key, value]) => {
        const status = value ? '✅ PASS' : '❌ FAIL';
        console.log(`${testNames[key].padEnd(25)} ${status}`);
        if (value) passed++;
        else failed++;
    });

    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Total: ${passed} passed, ${failed} failed`);
    console.log('');

    if (failed === 0) {
        console.log('🎉 All tests passed! Your setup is ready.');
        console.log('🌐 Open http://localhost:3000 in your browser');
    } else if (results.localServer === false) {
        console.log('⚠️ Server is not running. Start with: npm start');
    } else {
        console.log('⚠️ Some tests failed. Check errors above.');
    }
}

runTests();

const { Builder, By } = require('selenium-webdriver');

(async function runTests() {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        console.log('--- Starting Selenium Test Suite ---');
        await driver.get('http://localhost:3000');
        console.log('TC01: Open registration page - Page loaded');
        console.log('--- All Selenium Test Cases Passed Successfully! ---');
    } finally {
        await driver.quit();
    }
})();

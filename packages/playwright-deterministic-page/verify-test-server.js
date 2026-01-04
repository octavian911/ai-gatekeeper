import { startTestServer, stopTestServer, getTestUrl } from './tests/test-server.js';

async function verify() {
  try {
    console.log('Starting test server...');
    const url = await startTestServer();
    console.log('✓ Server started at:', url);
    
    console.log('Getting test URL...');
    const url2 = getTestUrl();
    console.log('✓ Got test URL:', url2);
    
    if (url !== url2) {
      throw new Error('URLs do not match!');
    }
    
    console.log('Fetching test page...');
    const response = await fetch(url);
    const html = await response.text();
    
    if (!html.includes('Deterministic Test Page')) {
      throw new Error('HTML does not contain expected title!');
    }
    console.log('✓ Test page contains expected content');
    
    console.log('Stopping test server...');
    await stopTestServer();
    console.log('✓ Server stopped');
    
    console.log('\n✅ All checks passed!');
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();

describe('Dashboard — paywall removal verification', () => {
  let source;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    source = fs.readFileSync(
      path.join(__dirname, '..', 'Dashboard.js'),
      'utf8'
    );
  });

  test('does not reference usePaywall hook', () => {
    expect(source).not.toContain('usePaywall');
  });

  test('does not reference wouldExceedLimit', () => {
    expect(source).not.toContain('wouldExceedLimit');
  });

  test('does not import from PaywallContext', () => {
    expect(source).not.toContain('PaywallContext');
  });

  test('does not reference LicenseService', () => {
    expect(source).not.toContain('LicenseService');
  });

  test('does not contain tile-count paywall gating', () => {
    expect(source).not.toContain('tileLimit');
    expect(source).not.toContain('maxTiles');
  });
});

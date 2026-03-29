describe('Admin — license tab removal verification', () => {
  let source;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    source = fs.readFileSync(
      path.join(__dirname, '..', 'Admin.js'),
      'utf8'
    );
  });

  test('does not have LicenseManagement component', () => {
    expect(source).not.toContain('LicenseManagement');
  });

  test('does not have license admin route', () => {
    expect(source).not.toContain('/admin/license');
  });

  test('does not reference PaywallContext', () => {
    expect(source).not.toContain('PaywallContext');
    expect(source).not.toContain('usePaywall');
  });
});

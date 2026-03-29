describe('Services — license service removal verification', () => {
  test('services index does not export LicenseService', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'index.js'),
      'utf8'
    );
    expect(source).not.toContain('LicenseService');
  });

  test('RestService does not contain license endpoints', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'RestService.js'),
      'utf8'
    );
    expect(source).not.toContain('/api/license');
    expect(source).not.toContain('validateLicense');
    expect(source).not.toContain('activateLicense');
  });
});

Package.describe({
  name: 'freelancecourtyard:tokenaffirm',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Meteor package to affirm actions of users.',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/peonmodel/TokenAffirm.git',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.5.1');
  api.use([
    'ecmascript',
    'mongo',
    'check',
    'random',
    'ddp-rate-limiter',
    'accounts-password',
  ]);
  api.imply([
    'accounts-password',
  ]);
  api.mainModule('tokenaffirm-server.js', 'server');
  api.mainModule('tokenaffirm-client.js', 'client');
});

Package.onTest(function(api) {
  // utility
  api.use([
    'ecmascript',
    // 'underscore',
    'mongo',
  ]);
  // test engine
  api.use([
    'practicalmeteor:mocha',
    'practicalmeteor:chai',
    // 'practicalmeteor:sinon',
  ]);
  // package to test
  api.use('freelancecourtyard:tokenaffirm');
  api.mainModule('tests/tokenaffirm-server-tests.js', 'server');
  api.mainModule('tests/tokenaffirm-client-tests.js', 'client');
});

module.exports = {
  root: true,
  extends: [
    'eslint:recommended'
  ],
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js'
  ]
};

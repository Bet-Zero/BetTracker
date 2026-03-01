// Quick test to see what's happening with MVP resolution
const { normalizeBetType } = require('./services/normalizationService.ts');

console.log('Testing MVP resolution:');
console.log('NBA context:', normalizeBetType('MVP', 'NBA'));
console.log('NFL context:', normalizeBetType('MVP', 'NFL'));
console.log('NHL context:', normalizeBetType('MVP', 'NHL'));
console.log('No context:', normalizeBetType('MVP'));

import { AIAgent } from '../src';

describe('AIAgent', () => {
  it('should export AIAgent class', () => {
    expect(AIAgent).toBeDefined();
    expect(typeof AIAgent).toBe('function');
  });
});

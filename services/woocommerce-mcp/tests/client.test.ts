import { describe, it, expect } from 'vitest';
import { WooClient } from '../src/woocommerce/client.js';

describe('woo client', () => {
  it('reports missing config instead of crashing', async () => {
    const woo = WooClient.missing();
    await expect(woo.get('/products')).rejects.toThrow(/not configured/);
  });
});

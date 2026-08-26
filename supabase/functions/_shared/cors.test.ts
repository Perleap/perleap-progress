import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getAllowedOrigins,
  getCorsHeaders,
  handleCorsPreflight,
  isOriginAllowed,
} from './cors.ts';

Deno.test('isOriginAllowed accepts perleap.ai and staging', () => {
  assertEquals(isOriginAllowed('https://perleap.ai'), true);
  assertEquals(isOriginAllowed('https://staging.perleap.ai'), true);
  assertEquals(isOriginAllowed('https://evil.example'), false);
});

Deno.test('getCorsHeaders reflects allowlisted Origin', () => {
  const req = new Request('https://example.com', {
    headers: { Origin: 'https://perleap.ai' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://perleap.ai');
  assertEquals(headers['Vary'], 'Origin');
});

Deno.test('getCorsHeaders omits ACAO for unknown Origin', () => {
  const req = new Request('https://example.com', {
    headers: { Origin: 'https://evil.example' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], undefined);
});

Deno.test('handleCorsPreflight returns 403 for unknown Origin', () => {
  const req = new Request('https://example.com', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  });
  assertEquals(handleCorsPreflight(req).status, 403);
});

Deno.test('handleCorsPreflight returns 204 for allowlisted Origin', () => {
  const req = new Request('https://example.com', {
    method: 'OPTIONS',
    headers: { Origin: 'https://staging.perleap.ai' },
  });
  assertEquals(handleCorsPreflight(req).status, 204);
});

Deno.test('getAllowedOrigins includes localhost dev ports', () => {
  const origins = getAllowedOrigins();
  assertEquals(origins.includes('http://localhost:8080'), true);
});

Deno.test('isOriginAllowed accepts any localhost port for dev', () => {
  assertEquals(isOriginAllowed('http://localhost:8880'), true);
  assertEquals(isOriginAllowed('http://127.0.0.1:5173'), true);
});

import request from 'supertest';
import { Express } from 'express';

export async function registerUser(app: Express, overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: overrides.name ?? 'Test User',
      email: overrides.email ?? `user-${Date.now()}-${Math.random()}@example.com`,
      password: overrides.password ?? 'password123',
    });

  return { token: res.body.token as string, user: res.body.user as { id: string; name: string; email: string } };
}

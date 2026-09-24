import request from 'supertest';
import { createApp } from '../src/app';
import { registerUser } from './helpers';

const app = createApp();

describe('boards', () => {
  it('creates a board and lists it for the owner only', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);

    const create = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Launch Plan' });

    expect(create.status).toBe(201);
    expect(create.body.board.name).toBe('Launch Plan');
    expect(create.body.board.members).toHaveLength(1);

    const ownerList = await request(app).get('/api/boards').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerList.body.boards).toHaveLength(1);

    const outsiderList = await request(app).get('/api/boards').set('Authorization', `Bearer ${outsider.token}`);
    expect(outsiderList.body.boards).toHaveLength(0);
  });

  it('blocks a non-member from reading or renaming a board', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);

    const board = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Private Board' });

    const boardId = board.body.board.id;

    const read = await request(app).get(`/api/boards/${boardId}`).set('Authorization', `Bearer ${outsider.token}`);
    expect(read.status).toBe(403);

    const rename = await request(app)
      .patch(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Hijacked' });
    expect(rename.status).toBe(403);
  });

  it('lets the owner invite a registered member by email', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app, { email: 'member@example.com' });

    const board = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Team Board' });

    const invite = await request(app)
      .post(`/api/boards/${board.body.board.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'member@example.com' });

    expect(invite.status).toBe(201);
    expect(invite.body.board.members).toHaveLength(2);

    const memberView = await request(app)
      .get(`/api/boards/${board.body.board.id}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(memberView.status).toBe(200);
  });

  it('rejects a non-owner trying to delete a board', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app, { email: 'member2@example.com' });

    const board = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'To Delete' });

    await request(app)
      .post(`/api/boards/${board.body.board.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'member2@example.com' });

    const attempt = await request(app)
      .delete(`/api/boards/${board.body.board.id}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(attempt.status).toBe(403);

    const success = await request(app)
      .delete(`/api/boards/${board.body.board.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(success.status).toBe(204);
  });
});

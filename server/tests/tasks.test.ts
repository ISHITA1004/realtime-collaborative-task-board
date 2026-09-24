import request from 'supertest';
import { createApp } from '../src/app';
import { registerUser } from './helpers';

const app = createApp();

async function setupBoard() {
  const owner = await registerUser(app);
  const board = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: 'Sprint Board' });

  return { owner, boardId: board.body.board.id as string };
}

describe('tasks', () => {
  it('creates a task defaulting to the todo column', async () => {
    const { owner, boardId } = await setupBoard();

    const res = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Write API docs' });

    expect(res.status).toBe(201);
    expect(res.body.task.status).toBe('todo');
    expect(res.body.task.version).toBe(0);
  });

  it('moves a task between columns and logs it as an activity entry', async () => {
    const { owner, boardId } = await setupBoard();

    const task = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Ship feature' });

    const move = await request(app)
      .patch(`/api/tasks/${task.body.task.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'in-progress', version: 0 });

    expect(move.status).toBe(200);
    expect(move.body.task.status).toBe('in-progress');
    expect(move.body.task.version).toBe(1);

    const activity = await request(app)
      .get(`/api/boards/${boardId}/activity`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(activity.body.activity[0].type).toBe('task_moved');
  });

  it('rejects an update sent against a stale version with a 409', async () => {
    const { owner, boardId } = await setupBoard();

    const task = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Two editors' });

    const taskId = task.body.task.id;

    const first = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Title changed by A', version: 0 });
    expect(first.status).toBe(200);

    const stale = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ description: 'Description changed by B', version: 0 });

    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(stale.body.task.title).toBe('Title changed by A');
  });

  it('deletes a task', async () => {
    const { owner, boardId } = await setupBoard();

    const task = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Temp task' });

    const del = await request(app)
      .delete(`/api/tasks/${task.body.task.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.tasks).toHaveLength(0);
  });

  it('blocks a non-member from creating a task on someone else board', async () => {
    const { boardId } = await setupBoard();
    const outsider = await registerUser(app);

    const res = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ title: 'Should fail' });

    expect(res.status).toBe(403);
  });
});

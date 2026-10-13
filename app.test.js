import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, db, ensureDemoUser, resetDatabase } from '../server.js';

test.beforeEach(async () => {
  await resetDatabase();
});

test('restores the documented demo password for an existing demo account', async () => {
  const wrongPasswordHash = await bcrypt.hash('oldpassword', 10);
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET name = ?, password_hash = ? WHERE email = ?',
      ['Renamed Demo Creator', wrongPasswordHash, 'demo@creatorflow.dev'],
      (error) => (error ? reject(error) : resolve())
    );
  });

  await ensureDemoUser();

  const login = await request(app).post('/api/login').send({
    email: 'demo@creatorflow.dev',
    password: 'demo1234',
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, 'Renamed Demo Creator');
});

test('registers a user and returns the dashboard', async () => {
  const agent = request.agent(app);

  const registerResponse = await agent
    .post('/api/register')
    .send({ name: 'Alice Creator', email: 'alice@example.com', password: 'password123' });

  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.user.email, 'alice@example.com');

  const dashboardResponse = await agent.get('/api/dashboard');
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.total, 0);

  const createResponse = await agent.post('/api/posts').send({
    title: 'New reel idea',
    body: 'This is a draft idea for an upcoming reel.',
    platform: 'Instagram',
    status: 'Draft',
    scheduled_at: null,
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.post.title, 'New reel idea');

  const updatedDashboard = await agent.get('/api/dashboard');
  assert.equal(updatedDashboard.body.total, 1);
  assert.equal(updatedDashboard.body.drafts, 1);
});

test('stores a scheduled post and exposes it in the calendar', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Bob Creator',
    email: 'bob@example.com',
    password: 'password123',
  });

  const response = await agent.post('/api/posts').send({
    title: 'Launch video',
    body: 'A demo scheduled post',
    platform: 'YouTube',
    status: 'Scheduled',
    scheduled_at: '2030-12-15T18:00:00',
  });

  assert.equal(response.status, 201);

  const calendarResponse = await agent.get('/api/calendar');
  assert.equal(calendarResponse.status, 200);
  assert.equal(calendarResponse.body.posts.length, 1);
  assert.equal(calendarResponse.body.posts[0].title, 'Launch video');
});

test('analytics screen is clearly labelled demo data', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Carol Creator',
    email: 'carol@example.com',
    password: 'password123',
  });

  const analyticsResponse = await agent.get('/api/analytics');
  assert.equal(analyticsResponse.status, 200);
  assert.equal(analyticsResponse.body.demoData, true);
  assert.equal(analyticsResponse.body.label, 'Demo data');
});

test('keeps content when a user logs out and back in', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Dana Creator',
    email: 'dana@example.com',
    password: 'password123',
  });

  await agent.post('/api/posts').send({
    title: 'Retention post',
    body: 'Keep this post even after logout.',
    platform: 'LinkedIn',
    status: 'Draft',
    scheduled_at: null,
  });

  const logoutResponse = await agent.post('/api/logout');
  assert.equal(logoutResponse.status, 200);

  const loginResponse = await agent.post('/api/login').send({
    email: 'dana@example.com',
    password: 'password123',
  });

  assert.equal(loginResponse.status, 200);

  const dashboardResponse = await agent.get('/api/dashboard');
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.total, 1);
  assert.equal(dashboardResponse.body.recentPosts[0].title, 'Retention post');
});

test('updates an existing content post', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Eve Creator',
    email: 'eve@example.com',
    password: 'password123',
  });

  const created = await agent.post('/api/posts').send({
    title: 'Old title',
    body: 'Old body',
    platform: 'YouTube',
    status: 'Draft',
    scheduled_at: null,
  });

  const updated = await agent.put(`/api/posts/${created.body.post.id}`).send({
    title: 'Updated title',
    body: 'Updated body',
    platform: 'Instagram',
    status: 'Draft',
    scheduled_at: null,
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.post.title, 'Updated title');
  assert.equal(updated.body.post.platform, 'Instagram');
});

test('updates and persists the signed-in user profile', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Frank Creator',
    email: 'frank@example.com',
    password: 'password123',
  });

  const updated = await agent.put('/api/me').send({
    name: 'Frank Updated',
    email: 'FRANK.UPDATED@example.com',
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.name, 'Frank Updated');
  assert.equal(updated.body.user.email, 'frank.updated@example.com');

  const currentUser = await agent.get('/api/me');
  assert.equal(currentUser.status, 200);
  assert.equal(currentUser.body.user.name, 'Frank Updated');
  assert.equal(currentUser.body.user.email, 'frank.updated@example.com');

  await agent.post('/api/logout');
  const login = await agent.post('/api/login').send({
    email: 'frank.updated@example.com',
    password: 'password123',
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, 'Frank Updated');
});

test('rejects a profile email already used by another account', async () => {
  const agent = request.agent(app);

  await agent.post('/api/register').send({
    name: 'Grace Creator',
    email: 'grace@example.com',
    password: 'password123',
  });
  await agent.post('/api/logout');
  await agent.post('/api/register').send({
    name: 'Henry Creator',
    email: 'henry@example.com',
    password: 'password123',
  });

  const updated = await agent.put('/api/me').send({
    name: 'Henry Updated',
    email: 'grace@example.com',
  });

  assert.equal(updated.status, 400);
  assert.equal(updated.body.error, 'That email is already in use.');

  const currentUser = await agent.get('/api/me');
  assert.equal(currentUser.body.user.name, 'Henry Creator');
  assert.equal(currentUser.body.user.email, 'henry@example.com');
});

const request = require('supertest');
const app = require('../../app');
const { pool, setupTestDB, teardownTestDB, closeTestDB } = require('../setup/testDB');
const db = require('../../db');

describe('Todo API Integration Tests', () => {
  // Setup test database before all tests
  beforeAll(async () => {
    await setupTestDB();
  });

  // Clean up data before each test
  beforeEach(async () => {
    await teardownTestDB();
  });

  // Close database connections after all tests
  afterAll(async () => {
    await closeTestDB();
    await db.closePool(); // Close the app's db pool
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.message).toBe('Server is running');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/todos', () => {
    it('should return empty array when no todos exist', async () => {
      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all todos', async () => {
      // Insert test data
      await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3)',
        ['Test Todo 1', 'Description 1', false]
      );
      await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3)',
        ['Test Todo 2', 'Description 2', true]
      );

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Test Todo 2'); // Ordered by created_at DESC
      expect(response.body[1].title).toBe('Test Todo 1');
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return a single todo by id', async () => {
      const insertResult = await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3) RETURNING *',
        ['Test Todo', 'Test Description', false]
      );
      const todoId = insertResult.rows[0].id;

      const response = await request(app).get(`/api/todos/${todoId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(todoId);
      expect(response.body.title).toBe('Test Todo');
      expect(response.body.description).toBe('Test Description');
      expect(response.body.completed).toBe(false);
    });

    it('should return 404 when todo not found', async () => {
      const response = await request(app).get('/api/todos/99999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo with title and description', async () => {
      const newTodo = {
        title: 'New Todo',
        description: 'New Description',
      };

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Todo');
      expect(response.body.description).toBe('New Description');
      expect(response.body.completed).toBe(false);
      expect(response.body.id).toBeDefined();

      // Verify it's in the database
      const dbResult = await pool.query('SELECT * FROM todos WHERE id = $1', [response.body.id]);
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].title).toBe('New Todo');
    });

    it('should create a todo without description', async () => {
      const newTodo = { title: 'Todo without description' };

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Todo without description');
      expect(response.body.description).toBe('');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ description: 'Description without title' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title is required' });
    });

    it('should return 400 when title is empty string', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title is required' });
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update a todo with all fields', async () => {
      const insertResult = await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3) RETURNING *',
        ['Original Title', 'Original Description', false]
      );
      const todoId = insertResult.rows[0].id;

      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description',
        completed: true,
      };

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(todoId);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Updated Description');
      expect(response.body.completed).toBe(true);

      // Verify in database
      const dbResult = await pool.query('SELECT * FROM todos WHERE id = $1', [todoId]);
      expect(dbResult.rows[0].title).toBe('Updated Title');
      expect(dbResult.rows[0].completed).toBe(true);
    });

    it('should update only completed status', async () => {
      const insertResult = await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3) RETURNING *',
        ['Todo Title', 'Todo Description', false]
      );
      const todoId = insertResult.rows[0].id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Todo Title'); // Unchanged
      expect(response.body.completed).toBe(true); // Changed
    });

    it('should return 400 when no fields to update', async () => {
      const insertResult = await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3) RETURNING *',
        ['Todo', 'Description', false]
      );
      const todoId = insertResult.rows[0].id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'No fields to update' });
    });

    it('should return 404 when todo not found', async () => {
      const response = await request(app)
        .put('/api/todos/99999')
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      const insertResult = await pool.query(
        'INSERT INTO todos (title, description, completed) VALUES ($1, $2, $3) RETURNING *',
        ['Todo to delete', 'Description', false]
      );
      const todoId = insertResult.rows[0].id;

      const response = await request(app).delete(`/api/todos/${todoId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Todo deleted successfully');
      expect(response.body.todo.id).toBe(todoId);

      // Verify it's deleted from database
      const dbResult = await pool.query('SELECT * FROM todos WHERE id = $1', [todoId]);
      expect(dbResult.rows).toHaveLength(0);
    });

    it('should return 404 when todo not found', async () => {
      const response = await request(app).delete('/api/todos/99999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });
  });

  describe('Full workflow integration test', () => {
    it('should create, read, update, and delete a todo', async () => {
      // 1. Create a todo
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Workflow Todo', description: 'Testing full workflow' });

      expect(createResponse.status).toBe(201);
      const todoId = createResponse.body.id;

      // 2. Read the todo
      const getResponse = await request(app).get(`/api/todos/${todoId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.title).toBe('Workflow Todo');

      // 3. Update the todo
      const updateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.completed).toBe(true);

      // 4. Verify in list
      const listResponse = await request(app).get('/api/todos');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].completed).toBe(true);

      // 5. Delete the todo
      const deleteResponse = await request(app).delete(`/api/todos/${todoId}`);
      expect(deleteResponse.status).toBe(200);

      // 6. Verify it's gone
      const finalListResponse = await request(app).get('/api/todos');
      expect(finalListResponse.status).toBe(200);
      expect(finalListResponse.body).toHaveLength(0);
    });
  });
});

const request = require('supertest');
const app = require('../app');

// Mock the database pool
jest.mock('../db', () => ({
  query: jest.fn(),
}));

const pool = require('../db');

describe('Todo API Endpoints', () => {
  // Suppress console.error during tests
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'OK',
        message: 'Server is running',
      });
    });
  });

  describe('GET /api/todos', () => {
    it('should return all todos', async () => {
      const mockTodos = [
        { id: 1, title: 'Test Todo 1', description: 'Description 1', completed: false },
        { id: 2, title: 'Test Todo 2', description: 'Description 2', completed: true },
      ];

      pool.query.mockResolvedValue({ rows: mockTodos });

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTodos);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM todos ORDER BY created_at DESC');
    });

    it('should return empty array when no todos exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return a single todo by id', async () => {
      const mockTodo = { id: 1, title: 'Test Todo', description: 'Test Description', completed: false };

      pool.query.mockResolvedValue({ rows: [mockTodo] });

      const response = await request(app).get('/api/todos/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTodo);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM todos WHERE id = $1', ['1']);
    });

    it('should return 404 when todo not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/todos/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/todos/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo', async () => {
      const newTodo = { title: 'New Todo', description: 'New Description' };
      const createdTodo = { id: 1, ...newTodo, completed: false };

      pool.query.mockResolvedValue({ rows: [createdTodo] });

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdTodo);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO todos (title, description) VALUES ($1, $2) RETURNING *',
        ['New Todo', 'New Description']
      );
    });

    it('should create a todo without description', async () => {
      const newTodo = { title: 'New Todo' };
      const createdTodo = { id: 1, title: 'New Todo', description: '', completed: false };

      pool.query.mockResolvedValue({ rows: [createdTodo] });

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo);

      expect(response.status).toBe(201);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO todos (title, description) VALUES ($1, $2) RETURNING *',
        ['New Todo', '']
      );
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ description: 'Description without title' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title is required' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return 400 when title is empty string', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '   ', description: 'Description' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title is required' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/todos')
        .send({ title: 'New Todo' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update a todo with all fields', async () => {
      const updateData = { title: 'Updated Title', description: 'Updated Description', completed: true };
      const updatedTodo = { id: 1, ...updateData };

      pool.query.mockResolvedValue({ rows: [updatedTodo] });

      const response = await request(app)
        .put('/api/todos/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedTodo);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE todos SET title = $1, description = $2, completed = $3 WHERE id = $4 RETURNING *',
        ['Updated Title', 'Updated Description', true, '1']
      );
    });

    it('should update only title', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedTodo = { id: 1, title: 'Updated Title', description: 'Old Description', completed: false };

      pool.query.mockResolvedValue({ rows: [updatedTodo] });

      const response = await request(app)
        .put('/api/todos/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE todos SET title = $1 WHERE id = $2 RETURNING *',
        ['Updated Title', '1']
      );
    });

    it('should update only completed status', async () => {
      const updateData = { completed: true };
      const updatedTodo = { id: 1, title: 'Todo', description: 'Description', completed: true };

      pool.query.mockResolvedValue({ rows: [updatedTodo] });

      const response = await request(app)
        .put('/api/todos/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *',
        [true, '1']
      );
    });

    it('should return 400 when no fields to update', async () => {
      const response = await request(app)
        .put('/api/todos/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'No fields to update' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return 404 when todo not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .put('/api/todos/999')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/todos/1')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      const deletedTodo = { id: 1, title: 'Deleted Todo', description: 'Description', completed: false };

      pool.query.mockResolvedValue({ rows: [deletedTodo] });

      const response = await request(app).delete('/api/todos/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Todo deleted successfully',
        todo: deletedTodo,
      });
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM todos WHERE id = $1 RETURNING *', ['1']);
    });

    it('should return 404 when todo not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete('/api/todos/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Todo not found' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/todos/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});

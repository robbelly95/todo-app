import { useState, useEffect } from 'react';
import TaskList from './components/TaskList';
import AddTask from './components/AddTask';

function App() {
  const [activeList, setActiveList] = useState('work');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = async (list) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?list=${list}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(activeList);
  }, [activeList]);

  const handleAddTask = async (title, due_date) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, list: activeList, due_date: due_date || undefined }),
      });
      if (!res.ok) throw new Error('Failed to add task');
      const newTask = await res.json();
      setTasks((prev) => [...prev, newTask]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (id, completed) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>✅ My Tasks</h1>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeList === 'work' ? 'active' : ''}`}
          onClick={() => setActiveList('work')}
        >
          💼 Work
        </button>
        <button
          className={`tab ${activeList === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveList('personal')}
        >
          🏠 Personal
        </button>
      </div>

      <div className="content">
        <AddTask onAdd={handleAddTask} />

        {error && <div className="error-message">⚠️ {error}</div>}

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : (
          <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}

export default App;

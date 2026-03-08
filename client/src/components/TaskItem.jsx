function TaskItem({ task, onToggle, onDelete }) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date.slice(0, 10) < today && !task.completed;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.slice(0, 10).split('-');
    return `${month}/${day}/${year}`;
  };

  let dueDateClass = 'task-due';
  if (task.completed) {
    dueDateClass += ' completed-due';
  } else if (isOverdue) {
    dueDateClass += ' overdue';
  }

  return (
    <div className={`task-item ${task.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id, task.completed)}
        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
      />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.due_date && (
          <div className={dueDateClass}>
            {isOverdue && !task.completed ? '⚠️ ' : '📅 '}
            Due {formatDate(task.due_date)}
          </div>
        )}
      </div>
      <button
        className="delete-btn"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete "${task.title}"`}
        title="Delete task"
      >
        🗑️
      </button>
    </div>
  );
}

export default TaskItem;

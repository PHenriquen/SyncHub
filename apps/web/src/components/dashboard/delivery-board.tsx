import type { BoardColumn } from '@/lib/domain';

export function DeliveryBoard({ columns }: { columns: BoardColumn[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Delivery board</h2>
        <span>Current workspace</span>
      </header>
      <div className="board">
        {columns.map((column) => (
          <div className="board-column" key={column.title}>
            <div className="column-title">
              <span>{column.title}</span>
              <span>{column.tasks.length}</span>
            </div>
            {column.tasks.map((task) => (
              <article className="task-card" key={task.key}>
                <span className="task-key">{task.key}</span>
                <h3>{task.title}</h3>
                <div className="task-meta">
                  <span className={`priority priority-${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                  <span className="avatar">{task.owner}</span>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

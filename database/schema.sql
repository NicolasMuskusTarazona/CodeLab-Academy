CREATE TABLE IF NOT EXISTS courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    level       TEXT    NOT NULL CHECK (level IN ('basico', 'intermedio', 'avanzado')),
    hours       INTEGER NOT NULL CHECK (hours > 0),
    price       REAL    NOT NULL CHECK (price >= 0),
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Acelera el filtro por nivel del listado.
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses (level);

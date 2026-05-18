use serde::Serialize;
use crate::db::AppState;

#[derive(Serialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub folder: String,
}

#[derive(Serialize)]
pub struct GraphEdge {
    pub a_id: String,
    pub b_id: String,
    pub kind: String,
    pub weight: f64,
}

#[derive(Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[tauri::command]
pub fn get_graph(state: tauri::State<AppState>) -> Result<GraphData, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, title, folder FROM notes")
        .map_err(|e| e.to_string())?;
    let nodes = stmt.query_map([], |r| Ok(GraphNode {
        id: r.get(0)?, title: r.get(1)?, folder: r.get(2)?,
    }))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT a_id, b_id, kind, weight FROM note_edges")
        .map_err(|e| e.to_string())?;
    let edges = stmt.query_map([], |r| Ok(GraphEdge {
        a_id: r.get(0)?, b_id: r.get(1)?, kind: r.get(2)?, weight: r.get(3)?,
    }))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(GraphData { nodes, edges })
}

#[cfg(test)]
mod tests {
    use crate::db::migrations::migrations;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_get_graph_returns_nodes_and_edges() {
        let conn = test_conn();
        conn.execute("INSERT INTO notes (id, title) VALUES ('a', 'A')", []).unwrap();
        conn.execute("INSERT INTO notes (id, title) VALUES ('b', 'B')", []).unwrap();
        conn.execute(
            "INSERT INTO note_edges (a_id, b_id, kind) VALUES ('a', 'b', 'explicit')", [],
        ).unwrap();
        let nodes: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM notes ORDER BY id").unwrap();
            stmt.query_map([], |r| r.get(0)).unwrap()
               .collect::<Result<Vec<_>, _>>().unwrap()
        };
        let edges: Vec<(String, String)> = {
            let mut stmt = conn.prepare("SELECT a_id, b_id FROM note_edges").unwrap();
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap()
               .collect::<Result<Vec<_>, _>>().unwrap()
        };
        assert_eq!(nodes.len(), 2);
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0], ("a".to_string(), "b".to_string()));
    }
}

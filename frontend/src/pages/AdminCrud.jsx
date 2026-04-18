import React, { useEffect, useState } from "react";
import "../styles/MainContent/AdminCrud.css";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const AdminCrud = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("__overview__");
  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [overview, setOverview] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    try {
      const roles = jwtDecode(token)?.roles || [];
      if (!roles.includes("admin")) {
        navigate("/");
      }
    } catch {
      navigate("/signin");
    }
  }, []);

  useEffect(() => {
    authFetch(`${API_BASE}/api/database/tables`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((data) => {
        if (Array.isArray(data)) setTables(data);
        else throw new Error("Tables response is not an array");
      })
      .catch((err) => {
        console.error("Failed to load tables:", err);
        setTables([]);
      });
  }, []);

  useEffect(() => {
    authFetch(`${API_BASE}/api/database/overview`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setOverview)
      .catch((err) => {
        console.error("Failed to fetch overview:", err);
        setOverview({});
      });
  }, []);

  useEffect(() => {
    if (!selectedTable || selectedTable === "__overview__") return;

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setData)
      .catch((err) => {
        console.error("Failed to load table data:", err);
        setData([]);
      });

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}/schema`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((schema) => {
        if (Array.isArray(schema)) {
          setSchema(schema);
          const pk = schema.find((col) => col.is_primary)?.name || schema[0]?.name;
          setPrimaryKey(pk);
        } else {
          throw new Error("Schema is not an array");
        }
      })
      .catch((err) => {
        console.error("Failed to load schema:", err);
        setSchema([]);
      });
  }, [selectedTable]);

  const handleChange = (e, name) => {
    setFormData({ ...formData, [name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanedFormData = { ...formData };
    if (editingId && primaryKey) delete cleanedFormData[primaryKey];

    const url = `${API_BASE}/api/database/tables/${selectedTable}` + (editingId ? `/${editingId}` : "");
    const method = editingId ? "PUT" : "POST";

    await authFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(cleanedFormData),
    });

    setFormData({});
    setEditingId(null);

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setData)
      .catch((err) => {
        console.error("Failed to reload data after submit:", err);
        setData([]);
      });
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row[primaryKey]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;

    await authFetch(`${API_BASE}/api/database/tables/${selectedTable}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setData)
      .catch((err) => {
        console.error("Failed to reload after delete:", err);
        setData([]);
      });
  };

  // Helper function to determine if a field should be excluded from the form
  const isAutoGeneratedField = (columnName) => {
    const autoGeneratedFields = ['id', 'created_at', 'updated_at', 'timestamp'];
    return autoGeneratedFields.includes(columnName.toLowerCase());
  };

  // Helper function to determine if a field should be disabled during editing
  const isDisabledField = (columnName) => {
    return editingId && isAutoGeneratedField(columnName);
  };

  return (
    <div className="admin-crud">
      <aside className="sidebar">
        <button className="home-button" onClick={() => navigate("/")}>
          <FaArrowLeft style={{ marginRight: "6px" }} />
          Back to Home
        </button>
        <h2>📦 Tables</h2>
        <ul>
          <li
            key="__overview__"
            className={selectedTable === "__overview__" ? "active" : ""}
            onClick={() => setSelectedTable("__overview__")}
          >
            📊 Overview
          </li>

          {tables.map((table) => (
            <li
              key={table}
              className={selectedTable === table ? "active" : ""}
              onClick={() => setSelectedTable(table)}
            >
              {table}
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <h1>🛠 Admin Database</h1>

        {selectedTable === "__overview__" ? (
          <div className="overview">
            <h2>📊 Overview</h2>
            <div className="overview-cards">
              <div className="card">
                <h3>👤 User</h3>
                <p>{overview.users ?? "..."}</p>
              </div>
              <div className="card">
                <h3>🎵 Song</h3>
                <p>{overview.songs ?? "..."}</p>
              </div>
              <div className="card">
                <h3>📁 Playlist</h3>
                <p>{overview.playlists ?? "..."}</p>
              </div>
              <div className="card">
                <h3>💿 Album</h3>
                <p>{overview.albums ?? "..."}</p>
              </div>
              <div className="card">
                <h3>🎤 Artist</h3>
                <p>{overview.artists ?? "..."}</p>
              </div>
            </div>
          </div>

        ) : selectedTable ? (
          <>
            <h2>Table: {selectedTable}</h2>
            <form onSubmit={handleSubmit} className="crud-form">
              {schema
                .filter(col => !(!editingId && isAutoGeneratedField(col.name))) // Hide auto-generated fields when creating
                .map((col) => {
                  const isDisabled = isDisabledField(col.name);

                  return (
                    <input
                      key={col.name}
                      name={col.name}
                      value={formData[col.name] || ""}
                      onChange={(e) => handleChange(e, col.name)}
                      placeholder={isDisabled ? `${col.name} (auto-generated)` : col.name}
                      disabled={isDisabled}
                      style={isDisabled ? { 
                        backgroundColor: '#f5f5f5', 
                        color: '#666',
                        cursor: 'not-allowed'
                      } : {}}
                    />
                  );
                })}
              <button type="submit">{editingId ? "Update" : "Create"}</button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingId(null);
                    setFormData({});
                  }}
                  style={{ marginLeft: '10px', backgroundColor: '#6c757d' }}
                >
                  Cancel
                </button>
              )}
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  {schema.map((col) => (
                    <th key={col.name}>{col.name}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data) &&
                  data.map((row, i) => (
                    <tr key={i}>
                      {schema.map((col) => (
                        <td key={col.name}>
                          {isAutoGeneratedField(col.name) ? (
                            <span style={{ color: '#666', fontStyle: 'italic' }}>
                              {row[col.name]}
                            </span>
                          ) : (
                            row[col.name]
                          )}
                        </td>
                      ))}
                      <td>
                        <button onClick={() => handleEdit(row)}>✏️</button>
                        <button onClick={() => handleDelete(row[primaryKey])}>🗑️</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>...</p>
        )}
      </main>
    </div>
  );
};

export default AdminCrud;
import mariadb from 'mariadb';
import express from 'express';
import cors from 'cors';

const app = express();

// Habilitar CORS
app.use(cors());
app.use(express.json());

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'caixa',
  password: 'caixa',
  database: 'caixa_enginyers',
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
  ssl: false
});

async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("Connected to MariaDB!");

    const rows = await conn.query("SELECT * from municipio");
    return(rows);
  } catch (err) {
    console.error("Connection error:", err);
    return [];
  } finally {
    if (conn) conn.release();
  }
}

app.get('/municipio', async (req, res) => {
  try {
    const municipioData = await testConnection();
    res.json(municipioData);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Error fetching data from the database');
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
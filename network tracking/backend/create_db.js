import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const rootUser = process.env.MYSQL_ROOT_USER || 'root';
  const rootPass = process.env.MYSQL_ROOT_PASSWORD;
  const appUser = process.env.MYSQL_USER || 'nt_user';
  const appPass = process.env.MYSQL_PASSWORD;
  const dbName = process.env.MYSQL_DATABASE || 'network_tracker';

  if (!rootPass) {
    console.error('Please provide MYSQL_ROOT_PASSWORD in env');
    process.exit(2);
  }
  if (!appPass) {
    console.error('Please provide MYSQL_PASSWORD for the app user in env');
    process.exit(2);
  }

  const connection = await mysql.createConnection({
    host,
    user: rootUser,
    password: rootPass,
    multipleStatements: true,
  });

  const sql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;
  CREATE USER IF NOT EXISTS '${appUser}'@'localhost' IDENTIFIED BY ?;
  GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'localhost';
  FLUSH PRIVILEGES;`;

  try {
    await connection.query(sql, [appPass]);
    console.log('Database and user created or already exist.');
  } catch (err) {
    console.error('Error creating DB/user:', err.message || err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

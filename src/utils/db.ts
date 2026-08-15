import mysql from "mysql2/promise";
export const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "ecommerce",
  password: "123456",
  port: 3306,
});

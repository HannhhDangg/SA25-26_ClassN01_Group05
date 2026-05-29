const {Pool} = require("pg");
require("dotenv").config();

const pool = new Pool({
    user: process.env.DB_USER || "admin",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "leave_management",
    password: process.env.DB_PASSWORD || "rootpassword",
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false,
    }
});

pool.connect((err, client,release) =>{
    if(err){
        return console.error("lỗi kết nối database:", err.stack);
    }
    console.log("đã kết nối thành công tới postgresql!");
    release();
});

module.exports = pool;
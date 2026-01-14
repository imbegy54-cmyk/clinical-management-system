require('dotenv').config();
const mysql = require('mysql2');

// إنشاء اتصال قاعدة البيانات
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'clinic_management',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// اختبار الاتصال
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        console.log('🔍 تفاصيل الإعدادات:');
        console.log('Host:', process.env.DB_HOST);
        console.log('User:', process.env.DB_USER);
        console.log('Database:', process.env.DB_NAME);
        console.log('Port:', process.env.DB_PORT);
    } else {
        console.log('✅ تم الاتصال بنجاح بقاعدة البيانات MySQL');
        console.log(`📊 قاعدة البيانات: ${process.env.DB_NAME}`);
        connection.release();
    }
});

// وظيفة للاستعلامات البسيطة
const query = (sql, params) => {
    return new Promise((resolve, reject) => {
        pool.execute(sql, params, (err, results) => {
            if (err) {
                console.error('❌ خطأ في الاستعلام:', err.message);
                console.error('🔍 SQL:', sql);
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// وظيفة لمعرفة عدد السجلات في كل جدول
const getTableCounts = async () => {
    try {
        const tables = ['users', 'doctors', 'patients', 'appointments', 'clinics', 'inventory'];
        const counts = {};
        
        for (const table of tables) {
            const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
            counts[table] = result[0].count;
        }
        
        console.log('📊 عدد السجلات في الجداول:');
        Object.entries(counts).forEach(([table, count]) => {
            console.log(`  ${table}: ${count} سجل`);
        });
        
        return counts;
    } catch (error) {
        console.error('❌ خطأ في جدد عدد السجلات:', error.message);
    }
};

module.exports = {
    pool,
    query,
    getTableCounts
};
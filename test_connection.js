require('dotenv').config();
const mysql = require('mysql2');

console.log('🔍 بدء اختبار الاتصال بقاعدة البيانات...');
console.log('===========================================');

// عرض إعدادات الاتصال (بدون كلمة المرور كاملة للأمان)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

console.log('⚙️ إعدادات الاتصال المستخدمة:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   Port: ${dbConfig.port}`);

// إنشاء اتصال
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

connection.connect((err) => {
    if (err) {
        console.error('❌ فشل الاتصال بقاعدة البيانات!');
        console.error('🔍 تفاصيل الخطأ:', err.message);
        console.log('\n🔧 حلول مقترحة:');
        console.log('1. تأكد من تشغيل خدمة MySQL');
        console.log('2. تأكد من صحة كلمة المرور في ملف .env');
        console.log('3. تأكد من وجود قاعدة البيانات clinic_management');
        console.log('4. جرب الاتصال باستخدام: mysql -u root -p');
        return;
    }
    
    console.log('\n✅ تم الاتصال بنجاح بقاعدة البيانات MySQL!');
    
    // جلب عدد الجداول
    connection.query('SHOW TABLES', (err, results) => {
        if (err) {
            console.error('❌ خطأ في جلب الجداول:', err.message);
            connection.end();
            return;
        }
        
        console.log(`\n📊 عدد الجداول: ${results.length}`);
        console.log('قائمة الجداول:');
        results.forEach((row, index) => {
            const tableName = row[`Tables_in_${process.env.DB_NAME}`];
            console.log(`  ${index + 1}. ${tableName}`);
        });
        
        // جلب بعض البيانات التجريبية
        console.log('\n📋 عينة من البيانات:');
        
        // جلب عدد الأطباء
        connection.query('SELECT COUNT(*) as doctor_count FROM doctors', (err, doctorResult) => {
            if (!err && doctorResult.length > 0) {
                console.log(`   👨‍⚕️ عدد الأطباء: ${doctorResult[0].doctor_count}`);
            }
            
            // جلب عدد المرضى
            connection.query('SELECT COUNT(*) as patient_count FROM patients', (err, patientResult) => {
                if (!err && patientResult.length > 0) {
                    console.log(`   👤 عدد المرضى: ${patientResult[0].patient_count}`);
                }
                
                // جلب عدد الحجوزات اليوم
                const today = new Date().toISOString().split('T')[0];
                connection.query('SELECT COUNT(*) as appointment_count FROM appointments WHERE appointment_date = ?', 
                    [today], 
                    (err, appointmentResult) => {
                        if (!err && appointmentResult.length > 0) {
                            console.log(`   📅 عدد الحجوزات اليوم (${today}): ${appointmentResult[0].appointment_count}`);
                        }
                        
                        console.log('\n🎉 اختبار الاتصال اكتمل بنجاح!');
                        console.log('✅ النظام جاهز للخطوة التالية.');
                        connection.end();
                    }
                );
            });
        });
    });
});
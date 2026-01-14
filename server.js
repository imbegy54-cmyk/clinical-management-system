require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// DATABASE CONNECTION
// ======================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'clinic_management',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// اختبار الاتصال
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
        connection.release();
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ======================
// API ROUTES - الأطباء
// ======================

// جلب جميع الأطباء
app.get('/api/doctors', (req, res) => {
    const sql = `
        SELECT 
            d.doctor_id,
            u.full_name,
            u.email,
            u.phone,
            d.specialization,
            d.license_number,
            d.experience_years,
            d.consultation_fee,
            d.is_available,
            d.qualifications,
            d.available_from,
            d.available_to,
            c.clinic_name,
            c.clinic_id
        FROM doctors d
        JOIN users u ON d.user_id = u.user_id
        JOIN clinics c ON d.clinic_id = c.clinic_id
        ORDER BY u.full_name
    `;
    
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('❌ خطأ في جلب الأطباء:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'خطأ في جلب البيانات' 
            });
            return;
        }
        
        console.log(`✅ تم جلب ${results.length} طبيب`);
        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
});

// جلب طبيب بواسطة ID
app.get('/api/doctors/:id', (req, res) => {
    const doctorId = req.params.id;
    
    const sql = `
        SELECT 
            d.doctor_id,
            u.full_name,
            u.email,
            u.phone,
            u.date_of_birth,
            u.gender,
            u.address,
            d.specialization,
            d.license_number,
            d.experience_years,
            d.consultation_fee,
            d.qualifications,
            d.available_from,
            d.available_to,
            d.max_patients_per_day,
            d.is_available,
            c.clinic_name,
            c.clinic_id
        FROM doctors d
        JOIN users u ON d.user_id = u.user_id
        JOIN clinics c ON d.clinic_id = c.clinic_id
        WHERE d.doctor_id = ?
    `;
    
    pool.query(sql, [doctorId], (err, results) => {
        if (err) {
            console.error('❌ خطأ في جلب بيانات الطبيب:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'خطأ في جلب البيانات' 
            });
            return;
        }
        
        if (results.length === 0) {
            res.status(404).json({ 
                success: false,
                error: 'لم يتم العثور على الطبيب' 
            });
            return;
        }
        
        res.json({
            success: true,
            data: results[0]
        });
    });
});

// إضافة طبيب جديد
app.post('/api/doctors', async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        phone,
        specialization,
        licenseNumber,
        qualifications,
        experienceYears,
        consultationFee,
        clinicId,
        isAvailable
    } = req.body;
    
    try {
        // بدء transaction
        const connection = await pool.promise().getConnection();
        await connection.beginTransaction();
        
        try {
            // 1. إضافة مستخدم جديد
            const fullName = `${firstName} ${lastName}`;
            const username = email.split('@')[0];
            const defaultPassword = await bcrypt.hash('123456', 10);
            
            const userSql = `
                INSERT INTO users 
                (username, password_hash, email, phone, user_type, full_name, is_active)
                VALUES (?, ?, ?, ?, 'doctor', ?, TRUE)
            `;
            
            const [userResult] = await connection.execute(userSql, [
                username,
                defaultPassword,
                email,
                phone,
                fullName
            ]);
            
            const userId = userResult.insertId;
            
            // 2. إضافة طبيب
            const doctorSql = `
                INSERT INTO doctors 
                (user_id, clinic_id, specialization, license_number, qualifications, 
                 experience_years, consultation_fee, is_available)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await connection.execute(doctorSql, [
                userId,
                clinicId || 1,
                specialization,
                licenseNumber,
                qualifications || '',
                experienceYears || 0,
                consultationFee || 0,
                isAvailable === 'true' || isAvailable === true ? 1 : 0
            ]);
            
            await connection.commit();
            connection.release();
            
            console.log(`✅ تم إضافة طبيب جديد: ${fullName}`);
            
            res.json({
                success: true,
                message: 'تم إضافة الطبيب بنجاح',
                data: {
                    doctorId: userId,
                    fullName: fullName,
                    email: email,
                    phone: phone,
                    specialization: specialization
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error('❌ خطأ في إضافة الطبيب:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'خطأ في إضافة الطبيب: ' + error.message
        });
    }
});

// تحديث طبيب
app.put('/api/doctors/:id', async (req, res) => {
    const doctorId = req.params.id;
    const {
        firstName,
        lastName,
        email,
        phone,
        specialization,
        licenseNumber,
        qualifications,
        experienceYears,
        consultationFee,
        isAvailable
    } = req.body;
    
    try {
        // 1. الحصول على user_id الخاص بالطبيب
        const getDoctorSql = `SELECT user_id FROM doctors WHERE doctor_id = ?`;
        const [doctorRows] = await pool.promise().execute(getDoctorSql, [doctorId]);
        
        if (doctorRows.length === 0) {
            res.status(404).json({ 
                success: false,
                error: 'لم يتم العثور على الطبيب' 
            });
            return;
        }
        
        const userId = doctorRows[0].user_id;
        const fullName = `${firstName} ${lastName}`;
        
        // 2. تحديث بيانات المستخدم
        const updateUserSql = `
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `;
        
        await pool.promise().execute(updateUserSql, [
            fullName,
            email,
            phone,
            userId
        ]);
        
        // 3. تحديث بيانات الطبيب
        const updateDoctorSql = `
            UPDATE doctors 
            SET specialization = ?, license_number = ?, qualifications = ?,
                experience_years = ?, consultation_fee = ?, is_available = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE doctor_id = ?
        `;
        
        await pool.promise().execute(updateDoctorSql, [
            specialization,
            licenseNumber,
            qualifications || '',
            experienceYears || 0,
            consultationFee || 0,
            isAvailable === 'true' || isAvailable === true ? 1 : 0,
            doctorId
        ]);
        
        console.log(`✅ تم تحديث الطبيب: ${fullName}`);
        
        res.json({
            success: true,
            message: 'تم تحديث بيانات الطبيب بنجاح',
            data: {
                doctorId: doctorId,
                fullName: fullName,
                email: email,
                phone: phone,
                specialization: specialization
            }
        });
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الطبيب:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'خطأ في تحديث الطبيب: ' + error.message
        });
    }
});

// حذف طبيب
app.delete('/api/doctors/:id', async (req, res) => {
    const doctorId = req.params.id;
    
    try {
        // 1. الحصول على user_id الخاص بالطبيب
        const getDoctorSql = `SELECT user_id FROM doctors WHERE doctor_id = ?`;
        const [doctorRows] = await pool.promise().execute(getDoctorSql, [doctorId]);
        
        if (doctorRows.length === 0) {
            res.status(404).json({ 
                success: false,
                error: 'لم يتم العثور على الطبيب' 
            });
            return;
        }
        
        const userId = doctorRows[0].user_id;
        
        // 2. حذف الطبيب (سيحذف المستخدم تلقائياً بسبب CASCADE)
        const deleteDoctorSql = `DELETE FROM doctors WHERE doctor_id = ?`;
        await pool.promise().execute(deleteDoctorSql, [doctorId]);
        
        console.log(`✅ تم حذف الطبيب رقم: ${doctorId}`);
        
        res.json({
            success: true,
            message: 'تم حذف الطبيب بنجاح'
        });
        
    } catch (error) {
        console.error('❌ خطأ في حذف الطبيب:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'خطأ في حذف الطبيب: ' + error.message
        });
    }
});

// ======================
// API ROUTES - المرضى
// ======================

// جلب جميع المرضى
app.get('/api/patients', (req, res) => {
    const sql = `
        SELECT 
            p.patient_id,
            u.full_name,
            u.email,
            u.phone,
            u.date_of_birth,
            u.gender,
            u.address,
            p.national_id,
            p.emergency_contact,
            p.blood_type,
            p.allergies,
            p.chronic_diseases,
            p.insurance_provider,
            p.insurance_number,
            DATE(p.created_at) as registration_date
        FROM patients p
        JOIN users u ON p.user_id = u.user_id
        ORDER BY u.full_name
        LIMIT 100
    `;
    
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('❌ خطأ في جلب المرضى:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'خطأ في جلب البيانات' 
            });
            return;
        }
        
        console.log(`✅ تم جلب ${results.length} مريض`);
        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
});

// إضافة مريض جديد
app.post('/api/patients', async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender,
        address,
        nationalId,
        emergencyContact,
        bloodType,
        allergies,
        chronicDiseases
    } = req.body;
    
    try {
        // بدء transaction
        const connection = await pool.promise().getConnection();
        await connection.beginTransaction();
        
        try {
            // 1. إضافة مستخدم جديد
            const fullName = `${firstName} ${lastName}`;
            const username = email.split('@')[0] || `patient_${Date.now()}`;
            const defaultPassword = await bcrypt.hash('123456', 10);
            
            const userSql = `
                INSERT INTO users 
                (username, password_hash, email, phone, user_type, full_name, 
                 date_of_birth, gender, address, is_active)
                VALUES (?, ?, ?, ?, 'patient', ?, ?, ?, ?, TRUE)
            `;
            
            const [userResult] = await connection.execute(userSql, [
                username,
                defaultPassword,
                email,
                phone,
                fullName,
                dateOfBirth || null,
                gender || null,
                address || null
            ]);
            
            const userId = userResult.insertId;
            
            // 2. إضافة مريض
            const patientSql = `
                INSERT INTO patients 
                (user_id, national_id, emergency_contact, blood_type, allergies, chronic_diseases)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            await connection.execute(patientSql, [
                userId,
                nationalId || null,
                emergencyContact || null,
                bloodType || null,
                allergies || null,
                chronicDiseases || null
            ]);
            
            await connection.commit();
            connection.release();
            
            console.log(`✅ تم إضافة مريض جديد: ${fullName}`);
            
            res.json({
                success: true,
                message: 'تم إضافة المريض بنجاح',
                data: {
                    patientId: userId,
                    fullName: fullName,
                    email: email,
                    phone: phone
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error('❌ خطأ في إضافة المريض:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'خطأ في إضافة المريض: ' + error.message
        });
    }
});

// ======================
// API ROUTES - الحجوزات
// ======================

// جلب الحجوزات اليوم
app.get('/api/appointments/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const sql = `
        SELECT 
            a.appointment_id,
            pu.full_name as patient_name,
            du.full_name as doctor_name,
            a.appointment_date,
            a.appointment_time,
            a.status,
            a.symptoms,
            a.fee,
            a.appointment_type,
            c.clinic_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN users pu ON p.user_id = pu.user_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        JOIN users du ON d.user_id = du.user_id
        JOIN clinics c ON a.clinic_id = c.clinic_id
        WHERE a.appointment_date = ?
        ORDER BY a.appointment_time
    `;
    
    pool.query(sql, [today], (err, results) => {
        if (err) {
            console.error('❌ خطأ في جلب الحجوزات:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'خطأ في جلب البيانات' 
            });
            return;
        }
        
        console.log(`✅ تم جلب ${results.length} حجز لليوم`);
        res.json({
            success: true,
            date: today,
            count: results.length,
            data: results
        });
    });
});

// إضافة حجز جديد
app.post('/api/appointments', async (req, res) => {
    const {
        patientId,
        doctorId,
        clinicId,
        appointmentDate,
        appointmentTime,
        symptoms,
        fee,
        appointmentType
    } = req.body;
    
    try {
        const sql = `
            INSERT INTO appointments 
            (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, 
             symptoms, fee, appointment_type, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP)
        `;
        
        const [result] = await pool.promise().execute(sql, [
            patientId,
            doctorId,
            clinicId || 1,
            appointmentDate,
            appointmentTime,
            symptoms || '',
            fee || 0,
            appointmentType || 'consultation'
        ]);
        
        console.log(`✅ تم إضافة حجز جديد رقم: ${result.insertId}`);
        
        res.json({
            success: true,
            message: 'تم إضافة الحجز بنجاح',
            data: {
                appointmentId: result.insertId,
                appointmentDate: appointmentDate,
                appointmentTime: appointmentTime
            }
        });
        
    } catch (error) {
        console.error('❌ خطأ في إضافة الحجز:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'خطأ في إضافة الحجز: ' + error.message
        });
    }
});

// ======================
// API ROUTES - الإحصائيات
// ======================
app.get('/api/dashboard/stats', (req, res) => {
    const queries = [
        'SELECT COUNT(*) as count FROM doctors',
        'SELECT COUNT(*) as count FROM patients',
        'SELECT COUNT(*) as count FROM appointments',
        'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURDATE()',
        'SELECT COUNT(*) as count FROM clinics WHERE is_active = 1',
        'SELECT COUNT(*) as count FROM invoices WHERE status = "pending"'
    ];
    
    const stats = {};
    let completedQueries = 0;
    
    queries.forEach((sql, index) => {
        pool.query(sql, (err, results) => {
            if (err) {
                stats[getStatKey(index)] = 0;
            } else {
                stats[getStatKey(index)] = results[0].count;
            }
            
            completedQueries++;
            
            if (completedQueries === queries.length) {
                res.json({
                    success: true,
                    data: stats,
                    timestamp: new Date().toLocaleString('ar-SA')
                });
            }
        });
    });
    
    function getStatKey(index) {
        const keys = [
            'totalDoctors',
            'totalPatients',
            'totalAppointments',
            'todayAppointments',
            'activeClinics',
            'pendingPayments'
        ];
        return keys[index];
    }
});

// ======================
// API ROUTES - البحث
// ======================
app.get('/api/search/doctors', (req, res) => {
    const searchTerm = req.query.q || '';
    
    const sql = `
        SELECT 
            d.doctor_id,
            u.full_name,
            u.email,
            u.phone,
            d.specialization,
            d.license_number,
            d.is_available,
            c.clinic_name
        FROM doctors d
        JOIN users u ON d.user_id = u.user_id
        JOIN clinics c ON d.clinic_id = c.clinic_id
        WHERE u.full_name LIKE ? OR d.specialization LIKE ? OR c.clinic_name LIKE ?
        LIMIT 20
    `;
    
    const searchPattern = `%${searchTerm}%`;
    
    pool.query(sql, [searchPattern, searchPattern, searchPattern], (err, results) => {
        if (err) {
            console.error('❌ خطأ في البحث:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'خطأ في البحث' 
            });
            return;
        }
        
        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
});

// ======================
// الفهرسة والصفحات الرئيسية
// ======================
app.get('/api', (req, res) => {
    res.json({
        app: 'نظام مستشفى حازم الدولي',
        version: '1.0.0',
        availableEndpoints: [
            'GET  /api/doctors - قائمة الأطباء',
            'POST /api/doctors - إضافة طبيب',
            'GET  /api/doctors/:id - بيانات طبيب',
            'PUT  /api/doctors/:id - تحديث طبيب',
            'DELETE /api/doctors/:id - حذف طبيب',
            'GET  /api/patients - قائمة المرضى',
            'POST /api/patients - إضافة مريض',
            'GET  /api/appointments/today - حجوزات اليوم',
            'POST /api/appointments - إضافة حجز',
            'GET  /api/dashboard/stats - إحصائيات النظام',
            'GET  /api/search/doctors?q=بحث - بحث عن أطباء'
        ],
        database: process.env.DB_NAME,
        status: 'يعمل ✅'
    });
});

// توجيه جميع الطلبات الأخرى إلى الصفحات الرئيسية
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================
// بدء السيرفر
// ======================
app.listen(PORT, () => {
    console.log(`
    🏥 نظام مستشفى حازم الدولي
    ====================================
    🚀 السيرفر يعمل على: http://localhost:${PORT}
    📊 قاعدة البيانات: ${process.env.DB_NAME}
    ⏰ الوقت: ${new Date().toLocaleString('ar-SA')}
    ====================================
    
    🔗 روابط API الجديدة:
    • POST /api/doctors - إضافة طبيب جديد
    • PUT  /api/doctors/:id - تحديث طبيب
    • DELETE /api/doctors/:id - حذف طبيب
    • POST /api/patients - إضافة مريض جديد
    • POST /api/appointments - إضافة حجز جديد
    ====================================
    `);
});
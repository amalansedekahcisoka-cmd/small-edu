const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBGqwxQ5Rijt60O2UP3QGeB0ZfKiZ0F5ww',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'small-edu.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'small-edu',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'small-edu.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1053085713176',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1053085713176:web:1d55bd5d2d09dde4a0946d',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Baca data lokal jika ada
const dbJsonPath = path.join(__dirname, '..', 'data', 'db.json');
let localDb = { users: [], classes: [], courses: [], chapters: [] };
if (fs.existsSync(dbJsonPath)) {
  try {
    const raw = fs.readFileSync(dbJsonPath, 'utf8').replace(/^\uFEFF/, '');
    localDb = JSON.parse(raw);
  } catch (e) {
    console.warn('Gagal membaca db.json:', e.message);
  }
}

const defaultUsers = [
  {
    id: 'user-superadmin',
    name: 'Superadmin',
    email: 'admin@smalledu.id',
    role: 'admin',
    nisn_nip: 'SA-001',
    password: 'Sheilaon7!!',
    mustChangePassword: false,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-superadmin-super',
    name: 'Superadmin',
    email: 'superadmin@smalledu.id',
    role: 'admin',
    nisn_nip: 'SA-002',
    password: 'Sheilaon7!!',
    mustChangePassword: false,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-teacher-rudiansyah',
    name: 'RUDIANSYAH, S.Pd.',
    email: 'rudiopok@smalledu.id',
    role: 'teacher',
    nisn_nip: '198820052025011045',
    password: '198820052025011045',
    assignedClasses: ['X RPL 1', 'X RPL 2'],
    mustChangePassword: false,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-teacher-1',
    name: 'Pak Budi Santoso, S.Kom',
    email: 'guru1@smalledu.id',
    role: 'teacher',
    nisn_nip: '198507122010011002',
    password: 'smalledu123',
    assignedClasses: ['X RPL 1'],
    mustChangePassword: false,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-anton',
    name: 'anton',
    email: 'anton@email.com',
    role: 'student',
    nisn_nip: '112211',
    gradeClass: 'X RPL 1',
    password: '112211',
    mustChangePassword: true,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-student-ica',
    name: 'Ica Aurelia',
    email: 'ica@smalledu.id',
    role: 'student',
    nisn_nip: '11111111',
    gradeClass: 'X RPL 1',
    password: '11111111',
    mustChangePassword: true,
    starsCount: 0,
    createdAt: new Date().toISOString(),
  },
];

async function seed() {
  console.log('=== MEMULAI SINKRONISASI FIRESTORE ===');

  // 1. Sinkronisasi Users
  const userMap = new Map();
  // Masukkan dari default
  defaultUsers.forEach(u => userMap.set(u.id, u));
  // Masukkan dari local db.json
  if (Array.isArray(localDb.users)) {
    localDb.users.forEach(u => {
      if (u && u.id) userMap.set(u.id, { ...userMap.get(u.id), ...u });
    });
  }

  console.log(`Mengunggah ${userMap.size} user ke Firestore...`);
  for (const [id, user] of userMap.entries()) {
    await setDoc(doc(db, 'users', id), user, { merge: true });
    console.log(` -> User Tersimpan: [${user.role}] ${user.name} (${user.email} / ${user.nisn_nip})`);
  }

  // 2. Sinkronisasi Classes
  if (Array.isArray(localDb.classes) && localDb.classes.length > 0) {
    console.log(`Mengunggah ${localDb.classes.length} kelas ke Firestore...`);
    for (const c of localDb.classes) {
      await setDoc(doc(db, 'classes', c.id), c, { merge: true });
      console.log(` -> Kelas Tersimpan: ${c.name} (${c.id})`);
    }
  }

  // 3. Sinkronisasi Courses & Chapters
  if (Array.isArray(localDb.courses) && localDb.courses.length > 0) {
    console.log(`Mengunggah ${localDb.courses.length} kursus ke Firestore...`);
    for (const crs of localDb.courses) {
      await setDoc(doc(db, 'courses', crs.id), crs, { merge: true });
      console.log(` -> Kursus Tersimpan: ${crs.title} (${crs.id})`);

      // Upload chapters for this course if exist
      if (Array.isArray(localDb.chapters)) {
        const chapters = localDb.chapters.filter(ch => ch.courseId === crs.id);
        for (const ch of chapters) {
          await setDoc(doc(db, 'courses', crs.id, 'chapters', ch.id), ch, { merge: true });
          console.log(`   -> Bab Tersimpan: ${ch.title} (${ch.id})`);
        }
      }
    }
  }

  // Verifikasi kembali data di Firestore
  const snap = await getDocs(collection(db, 'users'));
  console.log(`\n=== SINKRONISASI BERHASIL! Total Users di Firestore: ${snap.size} ===`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`[FIRESTORE] ${data.role.toUpperCase()}: ${data.name} | ${data.email} | NISN: ${data.nisn_nip}`);
  });

  process.exit(0);
}

seed().catch(err => {
  console.error('SEEDING GAGAL:', err);
  process.exit(1);
});

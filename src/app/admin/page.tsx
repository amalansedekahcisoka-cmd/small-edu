'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { User, ClassRoom } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  Users,
  GraduationCap,
  BookOpen,
  Plus,
  CheckCircle2,
  Trash2,
  BarChart3,
  UserPlus,
  School,
  KeyRound,
  Edit,
  X,
  RotateCcw,
} from 'lucide-react';

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'teachers' | 'students'>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Form Guru (Create)
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherNip, setTeacherNip] = useState('');

  // Form Kelas (Create)
  const [className, setClassName] = useState('');
  const [classMajor, setClassMajor] = useState('Rekayasa Perangkat Lunak');
  const [classGrade, setClassGrade] = useState('Kelas X');

  // Form Siswa (Create)
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentNisn, setStudentNisn] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentClass, setStudentClass] = useState('');

  // States untuk Edit Modal (Update)
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);

  // State Modal Konfirmasi Hapus Retro
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'guru' | 'siswa' | 'kelas';
    id: string;
    name: string;
  } | null>(null);

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'guru') {
      DataProvider.deleteUser(deleteConfirm.id);
      setNotification(`Data Guru "${deleteConfirm.name}" berhasil dihapus.`);
    } else if (deleteConfirm.type === 'siswa') {
      DataProvider.deleteUser(deleteConfirm.id);
      setNotification(`Data Siswa "${deleteConfirm.name}" berhasil dihapus.`);
    } else if (deleteConfirm.type === 'kelas') {
      DataProvider.deleteClass(deleteConfirm.id);
      setNotification(`Data Kelas "${deleteConfirm.name}" berhasil dihapus.`);
    }
    setDeleteConfirm(null);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  const loadData = async () => {
    const initialUsers = DataProvider.getUsers();
    setUsers(initialUsers);

    const initialClasses = DataProvider.getClasses();
    setClasses(initialClasses);
    if (initialClasses.length > 0 && !studentClass) {
      setStudentClass(initialClasses[0].name);
    }

    // Sinkronkan akun/kelas lokal ke Cloud Firestore (misal akun yang dibuat sebelum env aktif)
    await DataProvider.syncLocalToFirestore();

    // Tarik snapshot terbaru dari Cloud Firestore
    const asyncUsers = await DataProvider.getUsersAsync();
    setUsers(asyncUsers);

    const asyncClasses = await DataProvider.getClassesAsync();
    setClasses(asyncClasses);
  };

  useEffect(() => {
    if (tabParam === 'classes' || tabParam === 'teachers' || tabParam === 'students') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [tabParam]);

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Users
  const teachers = users.filter((u) => u.role === 'teacher');
  const students = users.filter((u) => u.role === 'student');

  // Hitung jumlah siswa per kelas untuk grafik
  const classDistribution = classes.map((c) => {
    const count = students.filter((s) => s.gradeClass === c.name).length;
    return { name: c.name, count };
  });

  const maxStudentCount = Math.max(1, ...classDistribution.map((d) => d.count));

  // --- CRUD GURU ---
  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherNip) return;

    DataProvider.addUser({
      name: teacherName.trim(),
      email: teacherEmail.trim(),
      role: 'teacher',
      nisn_nip: teacherNip.trim(),
    });

    setNotification(`Guru ${teacherName} berhasil ditambahkan! Kata sandi default adalah NIP: ${teacherNip.trim()}`);
    setTeacherName('');
    setTeacherEmail('');
    setTeacherNip('');
    loadData();
    setTimeout(() => setNotification(null), 6000);
  };

  const handleUpdateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    DataProvider.updateUser(editingTeacher.id, {
      name: editingTeacher.name.trim(),
      email: editingTeacher.email.trim(),
      nisn_nip: editingTeacher.nisn_nip?.trim(),
      password: editingTeacher.password?.trim(),
    });

    setNotification(`Data Guru ${editingTeacher.name} berhasil diperbarui!`);
    setEditingTeacher(null);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDeleteTeacher = (teacher: User) => {
    setDeleteConfirm({ type: 'guru', id: teacher.id, name: teacher.name });
  };

  // --- CRUD KELAS ---
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className) return;

    DataProvider.addClass({
      name: className.trim(),
      major: classMajor.trim(),
      gradeLevel: classGrade,
    });

    setNotification(`Kelas ${className.trim()} berhasil ditambahkan ke database!`);
    setClassName('');
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  const handleUpdateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    DataProvider.updateClass(editingClass.id, {
      name: editingClass.name.trim(),
      major: editingClass.major?.trim(),
      gradeLevel: editingClass.gradeLevel,
    });

    setNotification(`Data Kelas ${editingClass.name} berhasil diperbarui!`);
    setEditingClass(null);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDeleteClass = (classId: string, cName: string) => {
    setDeleteConfirm({ type: 'kelas', id: classId, name: cName });
  };

  // --- CRUD SISWA ---
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEmail || !studentNisn || !studentClass) return;

    const finalPassword = studentPassword.trim() || studentNisn.trim();
    const mustChange = !studentPassword.trim();

    DataProvider.addUser({
      name: studentName.trim(),
      email: studentEmail.trim(),
      role: 'student',
      nisn_nip: studentNisn.trim(),
      gradeClass: studentClass,
      password: finalPassword,
      mustChangePassword: mustChange,
    });

    setNotification(`Siswa ${studentName} (${studentClass}) berhasil didaftarkan! Email: ${studentEmail.trim()} | Sandi: ${finalPassword}`);
    setStudentName('');
    setStudentEmail('');
    setStudentNisn('');
    setStudentPassword('');
    loadData();
    setTimeout(() => setNotification(null), 7000);
  };

  const handleUpdateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    DataProvider.updateUser(editingStudent.id, {
      name: editingStudent.name.trim(),
      email: editingStudent.email.trim(),
      nisn_nip: editingStudent.nisn_nip?.trim(),
      gradeClass: editingStudent.gradeClass,
      password: editingStudent.password?.trim(),
      mustChangePassword: editingStudent.mustChangePassword,
    });

    setNotification(`Data Siswa ${editingStudent.name} berhasil diperbarui!`);
    setEditingStudent(null);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDeleteStudent = (student: User) => {
    setDeleteConfirm({ type: 'siswa', id: student.id, name: student.name });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-4 bg-[#79f2c0] neo-border neo-shadow-sm font-mono text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-950 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b-2 border-black pb-2 font-mono text-xs font-bold">
        <button
          onClick={() => {
            setActiveTab('overview');
            router.push('/admin?tab=overview');
          }}
          className={`px-4 py-2 neo-border-sm transition-all ${
            activeTab === 'overview' ? 'bg-[#008080] text-white neo-shadow-sm' : 'bg-white text-black hover:bg-zinc-100'
          }`}
        >
          📊 Ringkasan & Statistik
        </button>

        <button
          onClick={() => {
            setActiveTab('classes');
            router.push('/admin?tab=classes');
          }}
          className={`px-4 py-2 neo-border-sm transition-all ${
            activeTab === 'classes' ? 'bg-[#008080] text-white neo-shadow-sm' : 'bg-white text-black hover:bg-zinc-100'
          }`}
        >
          🏛️ Kelola Data Kelas ({classes.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('teachers');
            router.push('/admin?tab=teachers');
          }}
          className={`px-4 py-2 neo-border-sm transition-all ${
            activeTab === 'teachers' ? 'bg-[#008080] text-white neo-shadow-sm' : 'bg-white text-black hover:bg-zinc-100'
          }`}
        >
          👩‍🏫 Kelola Data Guru ({teachers.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('students');
            router.push('/admin?tab=students');
          }}
          className={`px-4 py-2 neo-border-sm transition-all ${
            activeTab === 'students' ? 'bg-[#008080] text-white neo-shadow-sm' : 'bg-white text-black hover:bg-zinc-100'
          }`}
        >
          🎓 Kelola Data Siswa ({students.length})
        </button>
      </div>

      {/* TAB 1: RINGKASAN & STATISTIK UTAMA (DENGAN GRAFIS JUMLAH SISWA & KELAS) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white neo-border neo-shadow p-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-zinc-600 font-bold uppercase">TOTAL SISWA</div>
                <div className="text-3xl font-black mt-1 text-black">{students.length} Siswa</div>
              </div>
              <div className="w-12 h-12 bg-[#008080] text-white neo-border-sm flex items-center justify-center font-bold text-xl">
                🎓
              </div>
            </div>

            <div className="bg-white neo-border neo-shadow p-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-zinc-600 font-bold uppercase">TOTAL KELAS</div>
                <div className="text-3xl font-black mt-1 text-black">{classes.length} Kelas</div>
              </div>
              <div className="w-12 h-12 bg-[#74b9ff] neo-border-sm flex items-center justify-center font-bold text-xl">
                🏛️
              </div>
            </div>

            <div className="bg-white neo-border neo-shadow p-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-zinc-600 font-bold uppercase">TOTAL GURU</div>
                <div className="text-3xl font-black mt-1 text-black">{teachers.length} Guru</div>
              </div>
              <div className="w-12 h-12 bg-[#79f2c0] neo-border-sm flex items-center justify-center font-bold text-xl">
                👩‍🏫
              </div>
            </div>
          </div>

          <RetroWindow
            title="GRAFIK DISTRIBUSI SISWA BERDASARKAN KELAS"
            headerColor="navy"
            icon={<BarChart3 className="w-4 h-4 text-yellow-300" />}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-600">Perbandingan jumlah siswa terdaftar di setiap kelas:</span>
                <span className="font-bold">Total Terdaftar: {students.length} Siswa</span>
              </div>

              {classes.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {classDistribution.map((item, idx) => {
                    const percentage = Math.round((item.count / maxStudentCount) * 100);
                    return (
                      <div key={idx} className="space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-black inline-block"></span>
                            {item.name}
                          </span>
                          <span>{item.count} Siswa</span>
                        </div>

                        <div className="w-full h-6 bg-[#dfdbd2] neo-border-sm overflow-hidden relative">
                          <div
                            className="h-full bg-[#008080] transition-all duration-500 border-r-2 border-black"
                            style={{ width: `${Math.max(item.count > 0 ? percentage : 0, 0)}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-3 text-[11px] font-bold text-black pointer-events-none">
                            {item.count > 0 ? `${item.count} Siswa Terdaftar` : 'Belum ada siswa'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 font-mono text-sm text-zinc-500">
                  Belum ada kelas yang terdaftar. Tambahkan kelas di tab <strong>Kelola Data Kelas</strong>.
                </div>
              )}
            </div>
          </RetroWindow>
        </div>
      )}

      {/* TAB 2: KELOLA DATA KELAS (DENGAN CRUD LENGKAP) */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <RetroWindow
              title="TAMBAH KELAS BARU"
              headerColor="mustard"
              icon={<School className="w-4 h-4" />}
            >
              <form onSubmit={handleAddClass} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Kelas:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10 RPL 1 / XI TKJ 2"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Tingkat Pendidikan:</label>
                  <select
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white font-bold"
                  >
                    <option value="Kelas X">Kelas X</option>
                    <option value="Kelas XI">Kelas XI</option>
                    <option value="Kelas XII">Kelas XII</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Jurusan / Kompetensi:</label>
                  <input
                    type="text"
                    value={classMajor}
                    onChange={(e) => setClassMajor(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div className="pt-2">
                  <RetroButton type="submit" variant="teal" className="w-full" size="sm" icon={<Plus className="w-4 h-4" />}>
                    Simpan Data Kelas
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <RetroWindow
              title={`DATABASE KELAS TERDAFTAR (${classes.length})`}
              headerColor="navy"
              icon={<School className="w-4 h-4 text-yellow-300" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono neo-border">
                  <thead className="bg-[#dfdbd2] border-b-2 border-black">
                    <tr>
                      <th className="p-2.5">Nama Kelas</th>
                      <th className="p-2.5">Tingkat</th>
                      <th className="p-2.5">Jurusan / Bidang</th>
                      <th className="p-2.5 text-center">Jumlah Siswa</th>
                      <th className="p-2.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c, idx) => {
                      const studentCount = students.filter((s) => s.gradeClass === c.name).length;
                      return (
                        <tr
                          key={c.id}
                          className={`border-b border-black ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#fcfaf5]'
                          }`}
                        >
                          <td className="p-2.5 font-bold text-black">{c.name}</td>
                          <td className="p-2.5">{c.gradeLevel}</td>
                          <td className="p-2.5 text-zinc-600">{c.major || '-'}</td>
                          <td className="p-2.5 text-center font-bold">
                            <RetroBadge variant="blue" size="sm">
                              {studentCount} Siswa
                            </RetroBadge>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingClass(c)}
                                className="p-1 neo-border-sm bg-[#008080] hover:bg-[#006666] text-white font-bold"
                                title="Ubah Data Kelas"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClass(c.id, c.name)}
                                className="p-1 neo-border-sm bg-[#ff7675] hover:bg-red-600 text-white font-bold"
                                title="Hapus Kelas"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* TAB 3: KELOLA DATA GURU (DENGAN CRUD LENGKAP) */}
      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <RetroWindow
              title="TAMBAH GURU BARU"
              headerColor="mustard"
              icon={<UserPlus className="w-4 h-4" />}
            >
              <form onSubmit={handleAddTeacher} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Lengkap & Gelar:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahmawati, S.Kom"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Alamat Email Guru:</label>
                  <input
                    type="email"
                    required
                    placeholder="rahma@smalledu.id"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">NIP (Nomor Induk Pegawai):</label>
                  <input
                    type="text"
                    required
                    placeholder="19850315..."
                    value={teacherNip}
                    onChange={(e) => setTeacherNip(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                  <div className="mt-1.5 p-2 bg-[#fff8db] border border-amber-400 text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>NIP otomatis menjadi kata sandi awal guru.</span>
                  </div>
                </div>

                <div className="pt-2">
                  <RetroButton type="submit" variant="teal" className="w-full" size="sm" icon={<Plus className="w-4 h-4" />}>
                    Daftarkan Guru Baru
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <RetroWindow
              title={`DAFTAR GURU TERDAFTAR (${teachers.length})`}
              headerColor="navy"
              icon={<GraduationCap className="w-4 h-4 text-yellow-300" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono neo-border">
                  <thead className="bg-[#dfdbd2] border-b-2 border-black">
                    <tr>
                      <th className="p-2.5">Nama Guru</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">NIP</th>
                      <th className="p-2.5">Password</th>
                      <th className="p-2.5 text-center">Aksi (Edit / Hapus)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`border-b border-black ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#fcfaf5]'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-black">{t.name}</td>
                        <td className="p-2.5 text-zinc-600">{t.email}</td>
                        <td className="p-2.5 font-bold">{t.nisn_nip || '-'}</td>
                        <td className="p-2.5">
                          <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-400 font-bold">
                            {t.password || t.nisn_nip || 'Sesuai NIP'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditingTeacher(t)}
                              className="p-1 neo-border-sm bg-[#008080] hover:bg-[#006666] text-white font-bold"
                              title="Ubah Data Guru"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTeacher(t)}
                              className="p-1 neo-border-sm bg-[#ff7675] hover:bg-red-600 text-white font-bold"
                              title="Hapus Guru"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {teachers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-500">
                          Belum ada guru yang didaftarkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* TAB 4: KELOLA DATA SISWA (DENGAN CRUD LENGKAP) */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <RetroWindow
              title="TAMBAH SISWA BARU"
              headerColor="mustard"
              icon={<UserPlus className="w-4 h-4" />}
            >
              <form onSubmit={handleAddStudent} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Pilih Kelas Siswa:</label>
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    required
                    className="w-full p-2 neo-border-sm bg-white font-bold"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Nama Lengkap Siswa:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmad Faiz"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Alamat Email Siswa:</label>
                  <input
                    type="email"
                    required
                    placeholder="faiz@smalledu.id"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">NISN Siswa:</label>
                  <input
                    type="text"
                    required
                    placeholder="008291..."
                    value={studentNisn}
                    onChange={(e) => setStudentNisn(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Kata Sandi Awal (Opsional):</label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika ingin gunakan NISN sebagai sandi awal"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                  <div className="mt-1.5 p-2 bg-[#fff8db] border border-amber-400 text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>Jika dikosongkan, NISN otomatis jadi sandi awal (wajib ganti sandi saat login pertama).</span>
                  </div>
                </div>

                <div className="pt-2">
                  <RetroButton type="submit" variant="teal" className="w-full" size="sm" icon={<Plus className="w-4 h-4" />}>
                    Daftarkan Siswa Baru
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <RetroWindow
              title={`DAFTAR SISWA TERDAFTAR (${students.length})`}
              headerColor="navy"
              icon={<Users className="w-4 h-4 text-yellow-300" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono neo-border">
                  <thead className="bg-[#dfdbd2] border-b-2 border-black">
                    <tr>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5">Kelas</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">NISN (Password)</th>
                      <th className="p-2.5">Status Sandi</th>
                      <th className="p-2.5 text-center">Aksi (Edit / Hapus)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={`border-b border-black ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#fcfaf5]'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-black">{s.name}</td>
                        <td className="p-2.5 font-bold text-blue-800">{s.gradeClass}</td>
                        <td className="p-2.5 text-zinc-600">{s.email}</td>
                        <td className="p-2.5 font-bold">{s.password || s.nisn_nip || '-'}</td>
                        <td className="p-2.5">
                          {s.mustChangePassword ? (
                            <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 border border-amber-400 font-bold">
                              Wajib Ganti
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-400 font-bold">
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditingStudent(s)}
                              className="p-1 neo-border-sm bg-[#008080] hover:bg-[#006666] text-white font-bold"
                              title="Ubah Data Siswa"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1 neo-border-sm bg-[#ff7675] hover:bg-red-600 text-white font-bold"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {students.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          Belum ada siswa yang didaftarkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT GURU --- */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title={`UBAH DATA GURU: ${editingTeacher.name}`}
              headerColor="mustard"
              icon={<Edit className="w-4 h-4" />}
              onClose={() => setEditingTeacher(null)}
            >
              <form onSubmit={handleUpdateTeacher} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Lengkap & Gelar:</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.name}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Alamat Email:</label>
                  <input
                    type="email"
                    required
                    value={editingTeacher.email}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">NIP (Nomor Induk Pegawai):</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.nisn_nip || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, nisn_nip: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Kata Sandi Akun:</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.password || editingTeacher.nisn_nip || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white font-bold"
                  />
                  <span className="text-[10px] text-zinc-500">Anda dapat mereset kata sandi guru langsung di sini.</span>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <RetroButton type="button" variant="white" size="sm" onClick={() => setEditingTeacher(null)}>
                    Batal
                  </RetroButton>
                  <RetroButton type="submit" variant="teal" size="sm">
                    Simpan Perubahan 💾
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT SISWA --- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title={`UBAH DATA SISWA: ${editingStudent.name}`}
              headerColor="teal"
              icon={<Edit className="w-4 h-4" />}
              onClose={() => setEditingStudent(null)}
            >
              <form onSubmit={handleUpdateStudent} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Lengkap Siswa:</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Kelas:</label>
                  <select
                    value={editingStudent.gradeClass}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gradeClass: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white font-bold"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Email Siswa:</label>
                  <input
                    type="email"
                    required
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">NISN / Nomor Induk:</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.nisn_nip || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nisn_nip: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Reset Kata Sandi:</label>
                  <input
                    type="text"
                    placeholder="Masukkan kata sandi baru"
                    value={editingStudent.password || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                  <span className="text-[10px] text-zinc-500">Ubah sandi jika siswa lupa password.</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-[#f8f9fa] border border-zinc-300">
                  <label htmlFor="editMustChangePassword" className="font-bold cursor-pointer">
                    Wajibkan ganti sandi saat login berikutnya:
                  </label>
                  <input
                    id="editMustChangePassword"
                    type="checkbox"
                    checked={editingStudent.mustChangePassword || false}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mustChangePassword: e.target.checked })}
                    className="w-4 h-4 accent-black cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <RetroButton type="button" variant="white" size="sm" onClick={() => setEditingStudent(null)}>
                    Batal
                  </RetroButton>
                  <RetroButton type="submit" variant="teal" size="sm">
                    Simpan Perubahan 💾
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT KELAS --- */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title={`UBAH DATA KELAS: ${editingClass.name}`}
              headerColor="teal"
              icon={<Edit className="w-4 h-4" />}
              onClose={() => setEditingClass(null)}
            >
              <form onSubmit={handleUpdateClass} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Kelas:</label>
                  <input
                    type="text"
                    required
                    value={editingClass.name}
                    onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Tingkat Pendidikan:</label>
                  <select
                    value={editingClass.gradeLevel || 'Kelas X'}
                    onChange={(e) => setEditingClass({ ...editingClass, gradeLevel: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white font-bold"
                  >
                    <option value="Kelas X">Kelas X</option>
                    <option value="Kelas XI">Kelas XI</option>
                    <option value="Kelas XII">Kelas XII</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Jurusan / Kompetensi:</label>
                  <input
                    type="text"
                    value={editingClass.major || ''}
                    onChange={(e) => setEditingClass({ ...editingClass, major: e.target.value })}
                    className="w-full p-2 neo-border-sm bg-white"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <RetroButton type="button" variant="white" size="sm" onClick={() => setEditingClass(null)}>
                    Batal
                  </RetroButton>
                  <RetroButton type="submit" variant="teal" size="sm">
                    Simpan Perubahan 💾
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS (RETRO MODAL) */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title="KONFIRMASI HAPUS DATA"
              headerColor="coral"
              icon={<Trash2 className="w-4 h-4 text-white" />}
            >
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-[#fff1f0] neo-border-sm p-4 text-center space-y-2">
                  <div className="w-12 h-12 bg-[#ff7675] neo-border flex items-center justify-center mx-auto text-white">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-red-950">
                    Hapus {deleteConfirm.type === 'guru' ? 'Guru' : deleteConfirm.type === 'siswa' ? 'Siswa' : 'Kelas'} Ini?
                  </h3>
                  <p className="text-xs text-zinc-700">
                    Apakah Anda yakin ingin menghapus data <strong>&quot;{deleteConfirm.name}&quot;</strong>? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
                  <RetroButton
                    type="button"
                    variant="white"
                    size="sm"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Batal
                  </RetroButton>
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#ff7675] hover:bg-red-500 text-white font-mono font-black neo-border-sm transition-all flex items-center gap-1.5"
                    onClick={executeDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Ya, Hapus Permanen 🗑️
                  </button>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-center">Memuat Panel Admin...</div>}>
      <AdminContent />
    </Suspense>
  );
}

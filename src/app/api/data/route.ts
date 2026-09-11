import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MOCK_USERS, MOCK_CLASSES, MOCK_COURSES, MOCK_CHAPTERS, MOCK_ACHIEVEMENTS, MOCK_ACTIVITY_LOGS, MOCK_SUBMISSIONS } from '@/lib/data/mockData';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: MOCK_USERS,
      classes: MOCK_CLASSES,
      courses: MOCK_COURSES,
      chapters: MOCK_CHAPTERS,
      submissions: MOCK_SUBMISSIONS,
      achievements: MOCK_ACHIEVEMENTS,
      activityLogs: MOCK_ACTIVITY_LOGS,
      deletedUserIds: [],
      deletedClassIds: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readDb() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM jika ada
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return null;
  }
}

function writeDb(data: any) {
  ensureDataFile();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/data - Retrieve current database snapshot
export async function GET() {
  const data = readDb();
  if (data) {
    // Sanitize user passwords so plain text passwords are never exposed to browser
    const sanitizedUsers = Array.isArray(data.users)
      ? data.users.map((u: any) => {
          const { password, ...rest } = u;
          return rest;
        })
      : [];

    return NextResponse.json(
      { ...data, users: sanitizedUsers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
  return NextResponse.json({}, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

// POST /api/data - Modify database with actions
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    const db = readDb();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    switch (action) {
      // --- USERS ---
      case 'ADD_USER': {
        const users = Array.isArray(db.users) ? db.users : [];
        // Check if user already exists
        const existingIdx = users.findIndex((u: any) => u.id === payload.id);
        if (existingIdx >= 0) {
          users[existingIdx] = payload;
        } else {
          users.push(payload);
        }
        db.users = users;
        break;
      }
      case 'UPDATE_USER': {
        const { userId, updates } = payload;
        db.users = (db.users || []).map((u: any) => (u.id === userId ? { ...u, ...updates } : u));
        break;
      }
      case 'DELETE_USER': {
        const { userId } = payload;
        if (!db.deletedUserIds) db.deletedUserIds = [];
        if (!db.deletedUserIds.includes(userId)) db.deletedUserIds.push(userId);
        db.users = (db.users || []).filter((u: any) => u.id !== userId);
        // Bersihkan log aktivitas dari user yang dihapus
        if (Array.isArray(db.activityLogs)) {
          db.activityLogs = db.activityLogs.filter((l: any) => l.userId !== userId);
        }
        break;
      }

      // --- CLASSES ---
      case 'ADD_CLASS': {
        db.classes = [...(db.classes || []), payload];
        break;
      }
      case 'UPDATE_CLASS': {
        const { classId, updates } = payload;
        db.classes = (db.classes || []).map((c: any) => (c.id === classId ? { ...c, ...updates } : c));
        break;
      }
      case 'DELETE_CLASS': {
        const { classId } = payload;
        if (!db.deletedClassIds) db.deletedClassIds = [];
        if (!db.deletedClassIds.includes(classId)) db.deletedClassIds.push(classId);
        db.classes = (db.classes || []).filter((c: any) => c.id !== classId);
        break;
      }

      // --- COURSES ---
      case 'ADD_COURSE': {
        const courses = Array.isArray(db.courses) ? db.courses : [];
        const existingIdx = courses.findIndex((c: any) => c.id === payload.id);
        if (existingIdx >= 0) {
          courses[existingIdx] = payload;
        } else {
          courses.push(payload);
        }
        db.courses = courses;
        break;
      }
      case 'UPDATE_COURSE': {
        const { courseId, updates } = payload;
        db.courses = (db.courses || []).map((c: any) => (c.id === courseId ? { ...c, ...updates } : c));
        break;
      }
      case 'DELETE_COURSE': {
        const { courseId } = payload;
        db.courses = (db.courses || []).filter((c: any) => c.id !== courseId);
        db.chapters = (db.chapters || []).filter((ch: any) => ch.courseId !== courseId);
        break;
      }

      // --- CHAPTERS ---
      case 'ADD_CHAPTER': {
        const chapters = Array.isArray(db.chapters) ? db.chapters : [];
        const existingIdx = chapters.findIndex((ch: any) => ch.id === payload.id);
        if (existingIdx >= 0) {
          chapters[existingIdx] = payload;
        } else {
          chapters.push(payload);
        }
        db.chapters = chapters;
        // update course chapter count
        if (payload.courseId) {
          const course = (db.courses || []).find((c: any) => c.id === payload.courseId);
          if (course) {
            course.chaptersCount = db.chapters.filter((ch: any) => ch.courseId === payload.courseId).length;
          }
        }
        break;
      }
      case 'UPDATE_CHAPTER': {
        const { chapterId, updates } = payload;
        db.chapters = (db.chapters || []).map((ch: any) => (ch.id === chapterId ? { ...ch, ...updates } : ch));
        break;
      }
      case 'DELETE_CHAPTER': {
        const { chapterId } = payload;
        const target = (db.chapters || []).find((ch: any) => ch.id === chapterId);
        db.chapters = (db.chapters || []).filter((ch: any) => ch.id !== chapterId);
        if (target?.courseId) {
          const course = (db.courses || []).find((c: any) => c.id === target.courseId);
          if (course) {
            course.chaptersCount = db.chapters.filter((ch: any) => ch.courseId === target.courseId).length;
          }
        }
        break;
      }

      // --- SUBMISSIONS ---
      case 'ADD_SUBMISSION': {
        db.submissions = [...(db.submissions || []), payload];
        break;
      }
      case 'UPDATE_SUBMISSION': {
        const { submissionId, updates } = payload;
        db.submissions = (db.submissions || []).map((s: any) => (s.id === submissionId ? { ...s, ...updates } : s));
        break;
      }

      // --- ACTIVITY LOGS ---
      case 'LOG_ACTIVITY': {
        const currentLogs = Array.isArray(db.activityLogs) ? db.activityLogs : [];
        const logEntry = { ...payload };
        if (!logEntry.userClass && logEntry.userId && Array.isArray(db.users)) {
          const matchedUser = db.users.find((u: any) => u.id === logEntry.userId);
          if (matchedUser?.gradeClass) {
            logEntry.userClass = matchedUser.gradeClass;
          }
        }
        const existingIdx = currentLogs.findIndex((l: any) => l.id === logEntry.id);
        if (existingIdx >= 0) {
          currentLogs[existingIdx] = logEntry;
        } else {
          currentLogs.unshift(logEntry);
        }
        db.activityLogs = currentLogs.slice(0, 300);
        break;
      }

      // --- STUDENT COURSE PROGRESS ---
      case 'SAVE_PROGRESS': {
        const { studentId, courseId, progressData } = payload;
        if (!db.progress) db.progress = {};
        const key = `${studentId}_${courseId}`;
        db.progress[key] = progressData;
        break;
      }

      // --- FULL OVERWRITE / SYNC ---
      case 'SYNC_ALL': {
        Object.assign(db, payload);
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    writeDb(db);
    return NextResponse.json({ success: true, db });
  } catch (err: any) {
    console.error('API /api/data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

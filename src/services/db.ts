import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Session, RulesetReport, Reference, WorkTask, TaskStatus } from '../types';

/* ============================
   DB Schema
   ============================ */

interface FWDashboardDB extends DBSchema {
    sessions: {
        key: string;
        value: Session;
        indexes: { 'by-analysis': string };
    };
    rulesetReports: {
        key: number;
        value: RulesetReport;
        indexes: { 'by-session': string };
    };
    references: {
        key: number;
        value: Reference;
        indexes: { 'by-ruleName': string };
    };
    workTasks: {
        key: number;
        value: WorkTask;
        indexes: { 'by-session': string; 'by-status': string };
    };
}

const DB_NAME = 'fwDashboard';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<FWDashboardDB>> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<FWDashboardDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // v1: sessions, rulesetReports, references
                if (oldVersion < 1) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('by-analysis', 'analysisId');

                    const reportStore = db.createObjectStore('rulesetReports', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    reportStore.createIndex('by-session', 'sessionId');

                    const refStore = db.createObjectStore('references', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    refStore.createIndex('by-ruleName', 'ruleName');
                }
                // v2: workTasks
                if (oldVersion < 2) {
                    const taskStore = db.createObjectStore('workTasks', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    taskStore.createIndex('by-session', 'sessionId');
                    taskStore.createIndex('by-status', 'status');
                }
            },
        });
    }
    return dbPromise;
}

/* ============================
   Sessions CRUD
   ============================ */

export async function saveSession(session: Session): Promise<void> {
    const db = await getDB();
    await db.put('sessions', session);
}

export async function getSessions(): Promise<Session[]> {
    const db = await getDB();
    return db.getAll('sessions');
}

export async function getSession(id: string): Promise<Session | undefined> {
    const db = await getDB();
    return db.get('sessions', id);
}

export async function deleteSession(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['sessions', 'rulesetReports'], 'readwrite');
    // delete reports first
    const reportIndex = tx.objectStore('rulesetReports').index('by-session');
    let cursor = await reportIndex.openCursor(id);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    // delete session
    await tx.objectStore('sessions').delete(id);
    await tx.done;
}

/* ============================
   RulesetReports CRUD
   ============================ */

export async function saveRulesetReports(reports: RulesetReport[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('rulesetReports', 'readwrite');
    for (const r of reports) {
        await tx.store.put(r);
    }
    await tx.done;
}

export async function getRulesetReportsBySession(sessionId: string): Promise<RulesetReport[]> {
    const db = await getDB();
    return db.getAllFromIndex('rulesetReports', 'by-session', sessionId);
}

/* ============================
   References CRUD
   ============================ */

export async function saveReferences(refs: Reference[]): Promise<void> {
    const db = await getDB();
    // clear existing first
    const tx = db.transaction('references', 'readwrite');
    await tx.store.clear();
    for (const ref of refs) {
        await tx.store.put(ref);
    }
    await tx.done;
}

export async function getReferences(): Promise<Reference[]> {
    const db = await getDB();
    return db.getAll('references');
}

export async function hasReferences(): Promise<boolean> {
    const db = await getDB();
    const count = await db.count('references');
    return count > 0;
}

/* ============================
   WorkTasks CRUD
   ============================ */

export async function saveTasks(tasks: WorkTask[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('workTasks', 'readwrite');
    for (const t of tasks) {
        await tx.store.put(t);
    }
    await tx.done;
}

export async function getTasksBySession(sessionId: string): Promise<WorkTask[]> {
    const db = await getDB();
    return db.getAllFromIndex('workTasks', 'by-session', sessionId);
}

export async function getAllTasks(): Promise<WorkTask[]> {
    const db = await getDB();
    return db.getAll('workTasks');
}

export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
    const db = await getDB();
    const task = await db.get('workTasks', taskId);
    if (task) {
        task.status = status;
        await db.put('workTasks', task);
    }
}

export async function clearTasksBySession(sessionId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('workTasks', 'readwrite');
    const index = tx.store.index('by-session');
    let cursor = await index.openCursor(sessionId);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

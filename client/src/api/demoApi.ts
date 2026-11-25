// In-browser implementation of the API contract: same business rules as the .NET server,
// persisted to localStorage, with a small latency so loading states are real.
import type { Db, EntityMap, Project, ResourceName } from '../domain/types';
import { addDays, daysBetween, today } from '../domain/dates';
import {
  RuleError, meetingConflicts, require, stageProblems, validateBudgetItem, validateClient, validatePayment, validateProject,
} from '../domain/rules';
import { ApiError, type Resource, type Resources, type StudioApi } from './api';
import { createSeed } from './seed';

const STORAGE_KEY = 'atelier-demo-v1';

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch { /* private mode / corrupted - fresh seed */ }
  return createSeed();
}

export function createDemoApi(latency = 200): StudioApi {
  let db = load();
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* ignore */ } };
  const wait = () => new Promise(r => setTimeout(r, latency * (0.6 + Math.random() * 0.8)));
  const clone = <T,>(v: T): T => structuredClone(v);

  type Hooks<K extends ResourceName> = {
    normalize?: (item: EntityMap[K], previous?: EntityMap[K]) => void;
    validate?: (item: EntityMap[K], previous?: EntityMap[K]) => void;
    beforeDelete?: (id: number) => void;
    afterDelete?: (id: number) => void;
  };

  const hooks: { [K in ResourceName]?: Hooks<K> } = {
    clients: {
      validate: validateClient,
      beforeDelete: id => require(!db.projects.some(p => p.clientId === id), 'לא ניתן למחוק לקוח שיש לו פרויקטים'),
    },
    projects: {
      normalize: (p: Project, prev?: Project) => { if (!prev || prev.stage !== p.stage) p.stageChangedAt = today(); },
      validate: (p: Project, prev?: Project) => {
        validateProject(p, db);
        if (prev && prev.stage !== p.stage) {
          const problems = stageProblems(p, p.stage, db);
          require(problems.length === 0, problems[0]);
        }
      },
      // a project owns its tasks, budget, payments and approvals
      afterDelete: id => {
        db.tasks = db.tasks.filter(t => t.projectId !== id);
        db.budgetItems = db.budgetItems.filter(b => b.projectId !== id);
        db.payments = db.payments.filter(x => x.projectId !== id);
        db.approvals = db.approvals.filter(a => a.projectId !== id);
        db.meetings = db.meetings.map(m => (m.projectId === id ? { ...m, projectId: null } : m));
      },
    },
    payments: { validate: x => validatePayment(x, db) },
    budgetItems: { validate: validateBudgetItem },
    meetings: {
      validate: m => {
        if (m.status === 'בוטל') return;
        const problems = meetingConflicts(m, db.meetings, db.workingHours);
        require(problems.length === 0, problems[0]);
      },
    },
  };

  async function run<T>(fn: () => T): Promise<T> {
    await wait();
    const snapshot = JSON.stringify(db);
    try {
      const result = fn();
      save();
      return clone(result);
    } catch (e) {
      db = JSON.parse(snapshot); // transactional: roll back partial changes
      if (e instanceof RuleError) throw new ApiError(e.message);
      throw e;
    }
  }

  function resource<K extends ResourceName>(name: K): Resource<EntityMap[K]> {
    type T = EntityMap[K];
    const table = () => db[name] as T[];
    const h = (hooks[name] ?? {}) as Hooks<K>;
    return {
      list: () => run(() => table()),
      create: input => run(() => {
        const item = { ...clone(input), id: Math.max(0, ...table().map(x => x.id)) + 1 } as T;
        h.normalize?.(item);
        h.validate?.(item);
        table().push(item);
        return item;
      }),
      update: input => run(() => {
        const idx = table().findIndex(x => x.id === input.id);
        require(idx >= 0, 'הרשומה לא נמצאה');
        const prev = table()[idx];
        const item = clone(input);
        h.normalize?.(item, prev);
        h.validate?.(item, prev);
        table()[idx] = item;
        return item;
      }),
      remove: id => run(() => {
        h.beforeDelete?.(id);
        const idx = table().findIndex(x => x.id === id);
        require(idx >= 0, 'הרשומה לא נמצאה');
        table().splice(idx, 1);
        h.afterDelete?.(id);
      }),
    };
  }

  const resources = Object.fromEntries(
    (Object.keys(db) as ResourceName[]).map(name => [name, resource(name)]),
  ) as unknown as Resources;

  return {
    mode: 'demo',
    resources,
    signProposal: input => run(() => {
      const p = db.projects.find(x => x.id === input.projectId);
      require(p, 'הפרויקט לא נמצא');
      require(Math.round(input.plan.reduce((s, x) => s + x.percent, 0)) === 100, 'לוח התשלומים חייב להסתכם ב-100%');
      Object.assign(p, { fee: input.fee, startDate: input.startDate, dueDate: input.dueDate, stage: 'נחתם', stageChangedAt: today() });
      validateProject(p, db);
      db.payments = db.payments.filter(x => x.projectId !== p.id);
      const span = Math.max(30, daysBetween(input.startDate, input.dueDate));
      let id = Math.max(0, ...db.payments.map(x => x.id));
      let acc = 0;
      for (const step of input.plan) {
        db.payments.push({
          id: ++id, projectId: p.id, label: step.label, percent: step.percent, amount: Math.round(input.fee * step.percent / 100),
          dueDate: addDays(input.startDate, Math.round(span * acc / 100)), paidDate: null,
        });
        acc += step.percent;
      }
    }),
    resetDemo: () => { db = createSeed(); save(); },
  };
}

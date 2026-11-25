// Domain model of the studio. The .NET API (see /server) exposes the same shapes in camelCase JSON.

export type LeadSource = 'המלצה' | 'אינסטגרם' | 'גוגל' | 'אתר הסטודיו' | 'תערוכה';
export type PropertyType = 'דירה' | 'בית פרטי' | 'פנטהאוז' | 'משרד' | 'מסחרי';
export type Style = 'מודרני' | 'סקנדינבי' | 'כפרי' | 'קלאסי' | 'תעשייתי' | 'ים תיכוני';
export type Stage = 'ליד' | 'פגישת היכרות' | 'הצעת מחיר' | 'נחתם' | 'תכנון' | 'ביצוע' | 'הושלם' | 'אבוד';
export type Phase = 'מדידות' | 'תכנון' | 'עיצוב והדמיות' | 'מכרזים' | 'ביצוע ופיקוח' | 'מסירה';
export type MeetingType = 'פגישת היכרות' | 'פגישת תכנון' | 'סיור באתר' | 'בחירת חומרים' | 'הצגת הדמיות';
export type BudgetCategory = 'ריצוף' | 'מטבח' | 'נגרות' | 'תאורה' | 'אינסטלציה' | 'צבע וגבס' | 'ריהוט' | 'חיפויים';

export interface Client {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  source: LeadSource;
  createdAt: string;      // yyyy-mm-dd
  notes: string;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  type: PropertyType;
  stage: Stage;
  style: Style;
  city: string;
  area: number;           // m²
  budget: number;         // client's renovation budget (₪)
  fee: number;            // studio fee (₪)
  startDate: string;
  dueDate: string;
  createdAt: string;
  stageChangedAt: string;
  palette: string[];      // hex colors (mood board)
  notes: string;
}

export interface Task {
  id: number;
  projectId: number;
  phase: Phase;
  title: string;
  dueDate: string;
  done: boolean;
}

export interface BudgetItem {
  id: number;
  projectId: number;
  category: BudgetCategory;
  planned: number;
  actual: number;
}

export interface Payment {
  id: number;
  projectId: number;
  label: string;
  percent: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
}

export interface Meeting {
  id: number;
  clientId: number;
  projectId: number | null;
  type: MeetingType;
  date: string;
  from: string;           // HH:mm
  to: string;
  city: string;
  status: 'מתוכנן' | 'התקיים' | 'בוטל';
  notes: string;
}

export interface WorkingHours {
  id: number;
  dayOfWeek: number;      // 0 = Sunday
  from: string;
  to: string;
}

export interface Inspiration {
  id: number;
  title: string;
  style: Style;
  room: string;
  image: string;          // file name under /img
  likes: number;
}

export interface Approval {
  id: number;
  projectId: number;
  title: string;
  version: number;
  status: 'ממתין לאישור' | 'אושר' | 'נדרשים שינויים';
  comment: string;
  date: string;
}

export interface EntityMap {
  clients: Client;
  projects: Project;
  tasks: Task;
  budgetItems: BudgetItem;
  payments: Payment;
  meetings: Meeting;
  workingHours: WorkingHours;
  inspirations: Inspiration;
  approvals: Approval;
}

export type ResourceName = keyof EntityMap;
export type Db = { [K in ResourceName]: EntityMap[K][] };

export const STAGES: Stage[] = ['ליד', 'פגישת היכרות', 'הצעת מחיר', 'נחתם', 'תכנון', 'ביצוע', 'הושלם'];
export const PHASES: Phase[] = ['מדידות', 'תכנון', 'עיצוב והדמיות', 'מכרזים', 'ביצוע ופיקוח', 'מסירה'];
export const STYLES: Style[] = ['מודרני', 'סקנדינבי', 'כפרי', 'קלאסי', 'תעשייתי', 'ים תיכוני'];
export const CATEGORIES: BudgetCategory[] = ['ריצוף', 'מטבח', 'נגרות', 'תאורה', 'אינסטלציה', 'צבע וגבס', 'ריהוט', 'חיפויים'];

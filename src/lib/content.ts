/**
 * Loads everything under /content at build time. To add material, drop files in:
 *   content/courses/<course-id>/course.json        course + modules
 *   content/courses/<course-id>/lessons/*.md       one lesson per file (frontmatter + Markdown)
 *   content/courses/<course-id>/quiz.json          optional questions
 *   content/news/*.json                            news items
 *   content/reference/*.md                         reference pages
 *   content/plans/*.json                           practice plans
 *   content/explainers/*.json                      motion-graphics explainer videos
 * See CONTENT_GUIDE.md for the exact formats.
 */
import { parseFrontmatter } from "./frontmatter";
import type { Explainer } from "./explainer";
import type { Course, GlossaryTerm, Lesson, NewsItem, Plan, QuizQuestion, RefPage, Snapshot } from "./types";

const courseFiles = import.meta.glob("/content/courses/*/course.json", { eager: true, import: "default" }) as Record<string, Course>;
const lessonFiles = import.meta.glob("/content/courses/*/lessons/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const quizFiles = import.meta.glob("/content/courses/*/quiz.json", { eager: true, import: "default" }) as Record<string, Omit<QuizQuestion, "courseId" | "index">[]>;
const newsFiles = import.meta.glob("/content/news/*.json", { eager: true, import: "default" }) as Record<string, Omit<NewsItem, "id">>;
const refFiles = import.meta.glob("/content/reference/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const planFiles = import.meta.glob("/content/plans/*.json", { eager: true, import: "default" }) as Record<string, Plan>;
const snapFiles = import.meta.glob("/content/market-snapshot.json", { eager: true, import: "default" }) as Record<string, Snapshot>;
const explainerFiles = import.meta.glob("/content/explainers/*.json", { eager: true, import: "default" }) as Record<string, Explainer>;
const glossFiles = import.meta.glob("/content/glossary.json", { eager: true, import: "default" }) as Record<string, GlossaryTerm[]>;

const folderOf = (path: string) => path.split("/")[3];
const fileId = (path: string) => path.split("/").pop()!.replace(/\.(json|md)$/, "");

export const courses: Course[] = Object.entries(courseFiles)
  .map(([p, c]) => ({ ...c, id: c.id || folderOf(p) }))
  .sort((a, b) => a.title.localeCompare(b.title));

export const lessons: Lesson[] = Object.entries(lessonFiles).map(([p, raw]) => {
  const { data, body } = parseFrontmatter(raw);
  return {
    courseId: folderOf(p), id: data.id || fileId(p), module: data.module || "", order: Number(data.order) || 0,
    title: data.title || fileId(p), duration: data.duration, meta: data.meta, video: data.video, body,
  };
}).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

export const quiz: QuizQuestion[] = Object.entries(quizFiles).flatMap(([p, qs]) =>
  qs.map((q, index) => ({ ...q, courseId: folderOf(p), index })));

export const news: NewsItem[] = Object.entries(newsFiles)
  .map(([p, n]) => ({ ...n, id: fileId(p) }))
  .sort((a, b) => b.date.localeCompare(a.date));

export const reference: RefPage[] = Object.entries(refFiles).map(([p, raw]) => {
  const { data, body } = parseFrontmatter(raw);
  return { id: data.id || fileId(p), title: data.title || fileId(p), order: Number(data.order) || 0, course: data.course, body };
}).sort((a, b) => a.order - b.order);

export const plans: Plan[] = Object.values(planFiles);
export const snapshot: Snapshot | null = Object.values(snapFiles)[0] ?? null;
export const glossary: GlossaryTerm[] = (Object.values(glossFiles)[0] ?? []).slice().sort((a, b) => a.term.localeCompare(b.term));

export const lessonsOf = (courseId: string) => lessons.filter((l) => l.courseId === courseId);
export const courseById = (id: string) => courses.find((c) => c.id === id);
export const lessonById = (courseId: string, id: string) => lessons.find((l) => l.courseId === courseId && l.id === id);
export const findLessonAnywhere = (id: string) => lessons.find((l) => l.id === id);
export const lessonKey = (l: Pick<Lesson, "courseId" | "id">) => `${l.courseId}:${l.id}`;
export const plainText = (md: string) => md.replace(/<[^>]+>/g, "").replace(/[*_#>`|]/g, "").replace(/\n{2,}/g, "\n").trim();

/** Motion-graphics explainer videos (content/explainers/*.json). */
export const explainers: Explainer[] = Object.entries(explainerFiles)
  .map(([p, e]) => ({ ...e, id: e.id || fileId(p) }))
  .sort((a, b) => a.course.localeCompare(b.course) || a.order - b.order);
export const explainerById = (id: string) => explainers.find((e) => e.id === id);
export const explainersForLesson = (courseId: string, lessonId: string) => explainers.filter((e) => e.course === courseId && e.lessons.includes(lessonId));

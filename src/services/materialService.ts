import type { CourseMaterial } from '@/types/models';
import {
  ASSIGNMENT_MATERIALS_BUCKET,
  COURSE_MATERIALS_BUCKET,
  downloadStorageBlob,
  resolveStorageStoredValue,
  type AuthenticatedBlobUrl,
} from '@/utils/storageUrls';

export function materialStorageBucket(material: CourseMaterial): string | null {
  if (material.type === 'link') return null;

  const filePath = material.file_path?.trim();
  if (filePath) {
    if (filePath.includes(ASSIGNMENT_MATERIALS_BUCKET)) {
      return ASSIGNMENT_MATERIALS_BUCKET;
    }
    if (filePath.includes(COURSE_MATERIALS_BUCKET)) {
      return COURSE_MATERIALS_BUCKET;
    }
    return null;
  }

  const url = material.url?.trim();
  if (url) {
    if (url.includes(`/${ASSIGNMENT_MATERIALS_BUCKET}/`)) return ASSIGNMENT_MATERIALS_BUCKET;
    if (url.includes(`/${COURSE_MATERIALS_BUCKET}/`)) return COURSE_MATERIALS_BUCKET;
  }

  return null;
}

export function resolveMaterialBucket(material: CourseMaterial, defaultBucket: string): string {
  if (material.type === 'link') return defaultBucket;
  return materialStorageBucket(material) ?? defaultBucket;
}

export async function resolveMaterialBlobUrl(
  material: CourseMaterial,
  bucket: string
): Promise<AuthenticatedBlobUrl | null> {
  if (material.type === 'link') {
    const link = material.url?.trim();
    if (!link) return null;
    return { url: link, revoke: () => {} };
  }
  return resolveStorageStoredValue(bucket, material.file_path, material.url);
}

export async function downloadMaterialFile(
  material: CourseMaterial,
  bucket: string
): Promise<Blob | null> {
  if (material.type === 'link') return null;
  const path = material.file_path?.trim();
  if (!path) return null;
  return downloadStorageBlob(bucket, path);
}

export async function openOrDownloadMaterial(
  material: CourseMaterial,
  bucket: string
): Promise<boolean> {
  const resolvedBucket = resolveMaterialBucket(material, bucket);
  if (material.type === 'link') {
    const link = material.url?.trim();
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  }

  const resolved = await resolveMaterialBlobUrl(material, resolvedBucket);
  if (!resolved) return false;

  if (resolved.url.startsWith('blob:')) {
    window.open(resolved.url, '_blank', 'noopener,noreferrer');
    return true;
  }

  window.open(resolved.url, '_blank', 'noopener,noreferrer');
  return true;
}

export function materialDisplayLabel(material: CourseMaterial): string {
  return material.name?.trim() || 'Material';
}

export function isPdfUploadFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function parseCourseMaterials(materialsData: unknown): CourseMaterial[] {
  if (!materialsData) return [];
  try {
    const materials = typeof materialsData === 'string' ? JSON.parse(materialsData) : materialsData;
    if (!Array.isArray(materials)) return [];
    return materials.filter(
      (m): m is CourseMaterial =>
        m != null &&
        typeof m === 'object' &&
        typeof (m as CourseMaterial).name === 'string' &&
        ((m as CourseMaterial).type === 'pdf' || (m as CourseMaterial).type === 'link')
    );
  } catch {
    return [];
  }
}

export function materialsMatch(a: CourseMaterial, b: CourseMaterial): boolean {
  if (a.name !== b.name || a.type !== b.type) return false;
  if (a.type === 'link') return (a.url ?? '') === (b.url ?? '');
  return (a.file_path ?? a.url ?? '') === (b.file_path ?? b.url ?? '');
}

export function materialPromptReference(material: CourseMaterial): string {
  if (material.type === 'link') {
    return material.url?.trim() ?? material.name;
  }
  return material.file_path?.trim() ?? material.name;
}

/** Normalize legacy materials that stored signed URLs in `url` for PDF uploads. */
export function normalizeCourseMaterial(material: CourseMaterial): CourseMaterial {
  if (material.type !== 'pdf') return material;
  if (material.file_path?.trim()) return material;
  const url = material.url?.trim();
  if (!url) return material;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const fromCourse = url.includes(`/course-materials/`);
    const fromAssignment = url.includes(`/assignment-materials/`);
    if (fromCourse || fromAssignment) {
      const marker = fromCourse ? '/course-materials/' : '/assignment-materials/';
      const idx = url.indexOf(marker);
      const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0] ?? '');
      return { ...material, file_path: path, url: undefined };
    }
  }
  return { ...material, file_path: url, url: undefined };
}

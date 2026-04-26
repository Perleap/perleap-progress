import { USER_ROLES } from '@/config/constants';

export type AppUserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const isAppAdminRole = (role: string | null | undefined): boolean => role === USER_ROLES.ADMIN;

export const isTeacherViewRole = (role: string | null | undefined): boolean =>
  role === USER_ROLES.TEACHER || role === USER_ROLES.ADMIN;

export const isValidAppRole = (role: string | null | undefined): role is AppUserRole =>
  role === USER_ROLES.TEACHER || role === USER_ROLES.STUDENT || role === USER_ROLES.ADMIN;

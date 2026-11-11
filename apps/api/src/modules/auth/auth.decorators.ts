import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export type RolUsuario = 'ADMIN' | 'ASESOR';

/**
 * Marca una ruta como pública (sin JWT). Usar SOLO para: login, formulario de captación,
 * checkout del estudiante y webhooks de proveedores (que validan su propia firma).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Roles permitidos para la ruta. Si no se indica, se exige ADMIN. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);

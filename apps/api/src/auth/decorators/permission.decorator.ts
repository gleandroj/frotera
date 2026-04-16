import { SetMetadata } from '@nestjs/common';
import { RoleModuleEnum, RoleActionEnum } from '../../roles/roles.dto';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: RoleModuleEnum;
  action: RoleActionEnum;
}

export const Permission = (module: RoleModuleEnum, action: RoleActionEnum) =>
  SetMetadata(PERMISSION_KEY, { module, action } as RequiredPermission);

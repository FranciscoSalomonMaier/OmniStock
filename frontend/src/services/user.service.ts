import { apiRequest } from './api'
export interface Profile{id:string;name:string;email:string;emailVerifiedAt:string|null;isActive:boolean;createdAt:string;updatedAt:string}
export const userService={profile:()=>apiRequest<Profile>('/users/me'),update:(name:string)=>apiRequest<Profile>('/users/me',{method:'PATCH',body:JSON.stringify({name})}),changePassword:(data:{currentPassword:string;newPassword:string;newPasswordConfirmation:string})=>apiRequest<{message:string}>('/users/me/password',{method:'PATCH',body:JSON.stringify(data)})}

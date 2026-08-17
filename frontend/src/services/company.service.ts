import { apiRequest } from './api'
import type { Company, CompanyRole, Membership } from '../types/company'
export const companyService={
 list:()=>apiRequest<Membership[]>('/companies'),
 create:(data:{legalName:string;tradeName:string;document:string;email?:string;phone?:string})=>apiRequest<{company:Company;membership:Membership}>('/companies',{method:'POST',body:JSON.stringify(data)}),
 update:(id:string,data:Partial<Company>)=>apiRequest<Company>(`/companies/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
 members:(id:string)=>apiRequest<Membership[]>(`/companies/${id}/members`),
 addMember:(id:string,email:string,role:CompanyRole)=>apiRequest<Membership>(`/companies/${id}/members`,{method:'POST',body:JSON.stringify({email,role})}),
 updateMember:(companyId:string,memberId:string,data:{role?:CompanyRole;isActive?:boolean})=>apiRequest<Membership>(`/companies/${companyId}/members/${memberId}`,{method:'PATCH',body:JSON.stringify(data)}),
 deactivate:(id:string)=>apiRequest<void>(`/companies/${id}`,{method:'DELETE'}),
}

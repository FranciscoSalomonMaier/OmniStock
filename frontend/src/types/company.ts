export type CompanyRole='ADMIN'|'MANAGER'|'STOCKIST'|'BILLING'|'SUPPORT'|'VIEWER'
export interface Company {id:string;legalName:string;tradeName:string;document:string;email:string|null;phone:string|null;isActive:boolean}
export interface Membership {id:string;companyId:string;userId:string;role:CompanyRole;isActive:boolean;company:Company;user?:{id:string;name:string;email:string}}

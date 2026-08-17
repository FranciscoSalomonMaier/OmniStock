import { createContext } from 'react'
import type { Company, Membership } from '../types/company'
export interface CompanyContextValue{companies:Membership[];activeCompany:Company|null;activeMembership:Membership|null;isLoading:boolean;selectCompany:(id:string)=>void;refreshCompanies:()=>Promise<void>;clearCompany:()=>void}
export const CompanyContext=createContext<CompanyContextValue|null>(null)

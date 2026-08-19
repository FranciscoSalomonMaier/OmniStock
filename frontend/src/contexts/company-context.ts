import { createContext } from 'react'
import type { Company, Membership } from '../types/company'
export interface CompanyContextValue{companies:Membership[];activeCompany:Company|null;activeMembership:Membership|null;pendingCompany:Company|null;isLoading:boolean;error:string;requestCompanySwitch:(id:string)=>void;confirmCompanySwitch:()=>void;cancelCompanySwitch:()=>void;refreshCompanies:()=>Promise<void>;clearCompany:()=>void}
export const CompanyContext=createContext<CompanyContextValue|null>(null)

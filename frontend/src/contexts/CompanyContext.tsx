import { useCallback,useEffect,useMemo,useState,type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { configureApiCompany } from '../services/api'
import { companyService } from '../services/company.service'
import type { Membership } from '../types/company'
import { CompanyContext } from './company-context'
export function CompanyProvider({children}:{children:ReactNode}){const{isAuthenticated}=useAuth();const[companies,setCompanies]=useState<Membership[]>([]);const[activeId,setActiveId]=useState<string|null>(()=>localStorage.getItem('omnistock_company_id'));const[isLoading,setLoading]=useState(false)
 const[hasLoaded,setHasLoaded]=useState(false);const clearCompany=useCallback(()=>{setCompanies([]);setActiveId(null);setHasLoaded(false);localStorage.removeItem('omnistock_company_id')},[])
 const selectCompany=useCallback((id:string)=>{setActiveId(id);localStorage.setItem('omnistock_company_id',id)},[])
 const refreshCompanies=useCallback(async()=>{if(!isAuthenticated)return;setLoading(true);try{const list=await companyService.list();setCompanies(list);const stored=localStorage.getItem('omnistock_company_id');const valid=list.find((item)=>item.companyId===stored);const next=valid?.companyId??list[0]?.companyId??null;if(next)selectCompany(next);else{setActiveId(null);localStorage.removeItem('omnistock_company_id')}setHasLoaded(true)}finally{setLoading(false)}},[isAuthenticated,selectCompany])
 useEffect(()=>{configureApiCompany(()=>activeId);queueMicrotask(()=>{if(isAuthenticated)void refreshCompanies();else clearCompany()})},[activeId,clearCompany,isAuthenticated,refreshCompanies])
 useEffect(()=>{window.addEventListener('omnistock:logout',clearCompany);return()=>window.removeEventListener('omnistock:logout',clearCompany)},[clearCompany])
 const activeMembership=companies.find((item)=>item.companyId===activeId)??null;const loading=isLoading||(isAuthenticated&&!hasLoaded);const value=useMemo(()=>({companies,activeMembership,activeCompany:activeMembership?.company??null,isLoading:loading,selectCompany,refreshCompanies,clearCompany}),[activeMembership,companies,loading,selectCompany,refreshCompanies,clearCompany]);return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>}

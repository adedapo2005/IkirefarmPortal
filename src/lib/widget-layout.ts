export type ReviewWidget={id:string;visible:boolean;size:string;collapsed:boolean};
export type MetricWidgetDefinition={id:string;label:string;route:string;permission:string;value:string;status:string;description:string;accent:string};
export const metricWidgetCatalog:MetricWidgetDefinition[]=[
  {id:'farm-pulse',label:'Farm Operations Pulse',route:'operations',permission:'farm.view',value:'Unavailable',status:'Awaiting farm source',description:'Operational exceptions, welfare signals and shift readiness.',accent:'green'},
  {id:'inventory-exceptions',label:'Inventory Exceptions',route:'inventory',permission:'inventory.view',value:'—',status:'No authoritative count',description:'Low stock, expiry, variance and transfer exceptions.',accent:'amber'},
  {id:'expense-approvals',label:'Expense Approval Queue',route:'expenses',permission:'expense.admin',value:'—',status:'No approved source',description:'Maker-checker decisions waiting in the authorized scope.',accent:'gold'},
  {id:'finance-summary',label:'Finance Summary',route:'finance',permission:'finance.view',value:'Unavailable',status:'Ledger not connected',description:'Revenue, expense and receivable pulse.',accent:'blue'},
  {id:'banking-state',label:'Banking State',route:'banking',permission:'banking.accounts.view',value:'0 connected',status:'Provider setup required',description:'Authorized accounts, sync and transaction exceptions.',accent:'cyan'},
  {id:'payroll-state',label:'Payroll State',route:'payroll',permission:'payroll.view',value:'Unavailable',status:'No payroll batch',description:'Due, processing, successful and failed salary outcomes.',accent:'violet'},
  {id:'sales-fulfillment',label:'Sales Fulfillment',route:'sales',permission:'sales.view',value:'—',status:'Orders unavailable',description:'Reservation, picking, dispatch and delivery state.',accent:'mint'},
  {id:'weather-state',label:'Farm Weather',route:'weather-lab',permission:'appearance.view',value:'Unavailable',status:'Provider not connected',description:'Public-safe configured farm weather state.',accent:'sky'},
  {id:'notification-state',label:'Notifications',route:'notifications',permission:'notifications.view',value:'—',status:'Authorized scope only',description:'Priority work and exceptions visible to this role.',accent:'rose'},
  {id:'market-freshness',label:'Market Evidence Freshness',route:'market',permission:'market.view',value:'Insufficient data',status:'No live observations',description:'Source age, confidence and completeness.',accent:'teal'},
  {id:'communication-queue',label:'Communication Queue',route:'communication',permission:'communication.view',value:'—',status:'Providers not configured',description:'Authorized customer messages requiring review.',accent:'indigo'},
];
const layouts=new Map<string,ReviewWidget[]>();const listeners=new Set<()=>void>();let revision=0;
export const widgetLayout={subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},revision:()=>revision,get:(person:string)=>layouts.get(person),save(person:string,items:ReviewWidget[]){layouts.set(person,items.map(w=>({...w})));revision++;listeners.forEach(fn=>fn())}};

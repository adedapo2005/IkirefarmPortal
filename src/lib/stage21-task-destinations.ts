import { canPage, has, type Persona } from './portal-model.ts';

// Navigation hints only. The destination resolves live authority and record scope.
// These are separate from the design lab's read-only reference-source mappings.
export const stage21Tasks: Readonly<Record<string, {
  title: string; route: string | null; viewPermission: string; createPermission?: string;
  limitation: string;
}>> = Object.freeze({
  eggs: {title:'Egg Collection',route:'eggs',viewPermission:'farm.eggs.view',createPermission:'farm.eggs.edit',limitation:'Record collection batches in the workspace. Corrections, batch edits and deletion remain paused.'},
  vaccinations: {title:'Vaccinations',route:'vaccinations',viewPermission:'vaccination.view',createPermission:'vaccination.edit',limitation:'Record and advance vaccination records in the workspace, with the required flock reference.'},
  procurement: {title:'Purchase Orders',route:'purchase-orders',viewPermission:'procurement.view',createPermission:'inventory.edit',limitation:'Purchase-order records are available. Quote comparison and sourcing approval remain an unconnected design proposal.'},
  suppliers: {title:'Supplier Records',route:'suppliers',viewPermission:'procurement.view',createPermission:'inventory.edit',limitation:'Review supplier identities and source evidence; registration uses the authorized supplier workspace.'},
  sales: {title:'Draft Sales Orders',route:'sales-drafts',viewPermission:'commercial.view',createPermission:'commercial.edit',limitation:'Create a draft order only, using an authorized customer lookup. No submission, approval, inventory reservation, invoice or financial posting occurs here. Customer codes are not durable identities or request receipts.'},
  customers: {title:'Customer Records',route:'customer-records',viewPermission:'commercial.view',createPermission:'commercial.edit',limitation:'Register and review customer records in the scoped workspace. Creation requires live commercial editing authority. Customer codes are not unique request receipts.'},
  employees: {title:'Employee Records',route:'employees',viewPermission:'hr.employee.view',createPermission:'hr.employee.manage',limitation:'Review employee records in the HR workspace. Employee-record management requires its separate assigned capability.'},
});
export function stage21TaskAccess(person: Persona, formId: string) {
  const task=Object.prototype.hasOwnProperty.call(stage21Tasks,formId)?stage21Tasks[formId]:null;
  if(!task)return null;
  const allowed=has(person,task.viewPermission) && (!task.route || canPage(person,task.route));
  const canCreate=allowed && Boolean(task.route && task.createPermission && has(person,task.createPermission));
  return {task,allowed,canCreate,href:allowed&&task.route?'#/'+task.route:null};
}
export function canReviewStage21Design(person: Persona, formId: string, permission: string) {
  const access=stage21TaskAccess(person,formId);
  return access?access.allowed:canPage(person,formId)&&has(person,permission);
}

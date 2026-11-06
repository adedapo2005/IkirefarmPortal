import React, { useState } from 'react';
import { 
  Shield, Plus, Check, CheckCircle2, AlertCircle, 
  Trash2, Edit3, Users, Key, Filter, Search, X, Sparkles
} from 'lucide-react';
import { 
  RoleDefinition, PermissionItem, INITIAL_ROLES, PERMISSION_CATALOG 
} from '../lib/roles.ts';

export const RoleManagementWorkspace: React.FC = () => {
  const [roles, setRoles] = useState<RoleDefinition[]>(INITIAL_ROLES);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition>(INITIAL_ROLES[0]);
  const [isCreatingRole, setIsCreatingRole] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // New Role Form State
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDescription, setNewRoleDescription] = useState<string>('');
  const [newRoleScope, setNewRoleScope] = useState<'enterprise' | 'farm_site' | 'department'>('farm_site');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Group permissions by category
  const categories = Array.from(new Set(PERMISSION_CATALOG.map(p => p.category)));

  const handleTogglePermission = (permId: string) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(id => id !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const handleSelectAllCategory = (cat: string) => {
    const catPermIds = PERMISSION_CATALOG.filter(p => p.category === cat).map(p => p.id);
    const allSelected = catPermIds.every(id => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter(id => !catPermIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedPermissions, ...catPermIds]));
      setSelectedPermissions(merged);
    }
  };

  const handleSaveNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const newRole: RoleDefinition = {
      id: `custom_${Date.now()}`,
      name: newRoleName,
      description: newRoleDescription || 'Custom role configured by Administrator',
      scope: newRoleScope,
      isCustom: true,
      userCount: 0,
      permissions: selectedPermissions,
    };

    setRoles([...roles, newRole]);
    setSelectedRole(newRole);
    setIsCreatingRole(false);
    
    // Reset Form
    setNewRoleName('');
    setNewRoleDescription('');
    setSelectedPermissions([]);

    setFeedbackToast(`Custom Role "${newRole.name}" created with ${newRole.permissions.length} assigned permissions.`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Administration</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Dynamic Roles & Permissions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#008751]" />
            Enterprise Role & Access Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create custom roles, assign granular permissions, and scope authority across Balogun-Ikire operational divisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreatingRole(true);
            setSelectedPermissions([]);
          }}
          className="btn-primary-glow px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4 icon-react" />
          Create New Custom Role
        </button>
      </div>

      {feedbackToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{feedbackToast}</span>
        </div>
      )}

      {/* Main Grid: Roles List (4 Cols) vs. Permission Inspector / Creator (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Roles Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
            <span>Configured Roles ({roles.length})</span>
            <span className="text-[11px] text-slate-400 font-normal">Select to inspect</span>
          </div>

          <div className="space-y-2">
            {roles.map((role) => {
              const isSelected = selectedRole.id === role.id && !isCreatingRole;

              return (
                <div
                  key={role.id}
                  onClick={() => {
                    setSelectedRole(role);
                    setIsCreatingRole(false);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-50/70 border-[#008751] shadow-xs ring-1 ring-[#008751]' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-sm text-slate-900">{role.name}</h3>
                    {role.isCustom && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 shrink-0">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{role.description}</p>
                  
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-mono-numbers">
                    <span className="flex items-center gap-1">
                      <Key className="w-3 h-3 text-[#008751]" />
                      {role.permissions.length} Permissions
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      {role.userCount} Users
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Custom Role Creator OR Role Permission Inspector (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs">
          
          {isCreatingRole ? (
            /* Mode 1: Create New Role Wizard */
            <form onSubmit={handleSaveNewRole} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#008751]" />
                    Design New Operational Role
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Define name, administrative scope, and select granular permission capabilities</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Role Metadata Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Feed Mill Supervisor / Shift Inspector"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Administrative Scope *</label>
                  <select
                    value={newRoleScope}
                    onChange={(e) => setNewRoleScope(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden font-medium"
                  >
                    <option value="enterprise">Enterprise Wide (Balogun-Ikire + US Executive)</option>
                    <option value="farm_site">Farm Site Scoped (Balogun-Ikire Main Complex)</option>
                    <option value="department">Department Unit Only (e.g. Egg Room / Mill)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Outline responsibilities and authorization boundaries..."
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
                />
              </div>

              {/* Granular Permission Matrix Checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Select Granted Permissions ({selectedPermissions.length} of {PERMISSION_CATALOG.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Fail-closed: unselected permissions return 404</span>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const catPerms = PERMISSION_CATALOG.filter(p => p.category === cat);
                    const allCatSelected = catPerms.every(p => selectedPermissions.includes(p.id));

                    return (
                      <div key={cat} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-900">{cat}</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllCategory(cat)}
                            className="text-[11px] font-semibold text-[#008751] hover:underline cursor-pointer"
                          >
                            {allCatSelected ? 'Deselect All' : 'Select Category'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {catPerms.map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.id);

                            return (
                              <label
                                key={perm.id}
                                className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition cursor-pointer ${
                                  isChecked 
                                    ? 'bg-emerald-50/80 border-[#008751] text-[#005A36]' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.id)}
                                  className="accent-[#008751] w-4 h-4 mt-0.5 shrink-0"
                                />
                                <div>
                                  <strong className="block text-xs font-semibold leading-tight">{perm.name}</strong>
                                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{perm.description}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedPermissions.length === 0}
                  className="btn-primary-glow px-5 py-2 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Commit Role & Permissions
                </button>
              </div>

            </form>
          ) : (
            /* Mode 2: Selected Role Inspector */
            <div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900">{selectedRole.name}</h2>
                    {selectedRole.isCustom && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        Custom Role
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{selectedRole.description}</p>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 capitalize">
                  Scope: {selectedRole.scope.replace('_', ' ')}
                </span>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Effective Granted Capabilities ({selectedRole.permissions.length})
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold">Active & Enforced</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {selectedRole.permissions.map((permId) => {
                  const permDef = PERMISSION_CATALOG.find(p => p.id === permId);
                  
                  return (
                    <div key={permId} className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs">
                      <div className="flex items-center gap-2 text-[#005A36] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#008751]" />
                        <span>{permDef?.name || permId}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {permDef?.description || 'Custom administrative capability'}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};

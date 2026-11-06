import {clone,template,validateDesign} from './model.mjs';

export const SAVED_SIGNIN_SOURCES={
  V52:{source:'708b5ec5b8a127668de6c6b12fbdfc215d665f20',status:'Current Live'},
  V53:{source:'e3bef51680919ee9375f448bc165d5ccb60b9911',status:'Historical'},
  V54:{source:'1c6755b1ed174a6d444de47f3363898e1f3a99cd',status:'Historical Candidate'},
};

const editableKinds=['Logo','Tagline','Hero','Farm Weather','Daily Spotlight','Nigerian Intelligence','Global Operations Time + Weather','Capability Rail','Employee Sign-In','Footer'];

export function editableSavedSignIn(version='V52'){
  if(!SAVED_SIGNIN_SOURCES[version])throw Error('Saved Sign-In version is unavailable.');
  const design=clone(template('Reference V3'));
  design.name=`${version} — Editable Copy`;
  design.baseVersion=`${version}:${SAVED_SIGNIN_SOURCES[version].source}`;
  design.page.scroll={desktop:'No Scroll',tablet:'Auto',mobile:'Vertical'};
  design.nodes.forEach((node,index)=>{
    node.name=editableKinds[index]||node.name;
    if(node.kind==='Farm Weather')node.data.inputs.designMode='UNAVAILABLE';
    if(node.kind.includes('Global Operations'))node.data.inputs.designMode='UNAVAILABLE';
  });
  design.editor={references:[],favorites:[],recent:editableKinds.slice(0,8)};
  design.metadata={
    ...design.metadata,
    notes:`Editable component reconstruction of saved ${version} (${SAVED_SIGNIN_SOURCES[version].source}). The historical version remains immutable. Legacy presentation details without a declarative Studio equivalent are preserved in history rather than flattened into this draft.`,
    updatedAt:new Date().toISOString(),
  };
  return validateDesign(design);
}

export function clearWorkingCanvas(design){
  const next=clone(design);
  next.name='Untitled Blank Experience';
  next.baseVersion='Cleared Working Draft';
  next.nodes=[];
  next.metadata={...next.metadata,updatedAt:new Date().toISOString(),notes:'Canvas cleared by Owner. Saved versions, assets, templates, and reusable components remain intact.'};
  return validateDesign(next);
}

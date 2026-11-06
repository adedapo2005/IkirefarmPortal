'use client';
import React,{useState,useEffect,useCallback,lazy,Suspense} from 'react';
import {ArrowUpRight,ArrowRight,ChevronRight,CloudOff,Egg,Wheat,Bird,Clock3,Check,Leaf,CalendarDays,Shield,Monitor,Smartphone,Mail,MapPin,FileText,BookOpen,Target,WifiOff,Sun,KeyRound,LockKeyhole} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {toast} from 'sonner';
import {WorkspaceProps} from './PortalExperience';
import LoggedTimestamp from './LoggedTimestamp';
import {canPage,pages,has} from '@/lib/portal-model';
import {Panel,Btn,Chip,Lens,Weather,RecordList,Timeline,Progress,Empty,DataTable,AsyncButtonLabel} from './Common';
const Chart=lazy(()=>import('./Charts'));
export function Dashboard({person,go,period,notices,detail}:WorkspaceProps){if(!canPage(person,'eggs')&&!canPage(person,'finance')&&!canPage(person,'myday'))return <Panel title="Your workspace"><div className="stack">{pages.filter(p=>p.id!=='dashboard'&&canPage(person,p.id)).map(p=><Btn key={p.id} onClick={()=>go(p.id)}>{p.title}</Btn>)}</div></Panel>;const egg=canPage(person,'eggs'),finance=canPage(person,'finance'),feed=canPage(person,'feed');const shortcuts=pages.filter(p=>canPage(person,p.id)&&['eggs','myday','inventory','finance','leave','payslips','knowledge','health'].includes(p.id)).slice(0,4);return <div className="dashboard-layout"><div className="stack"><section className="decision-brief"><div><Chip>{egg?'Today On The Farm':finance?'Your Financial Workspace':'Your Personal Workspace'}</Chip><h2>{egg?'A New Day. A Clearer Picture.':finance?'See The Movement. Follow The Evidence.':'Make Space For Your Best Work.'}</h2><p>{egg?'Follow collections and the work awaiting your attention. Every signal has a next step.':finance?'Review the period’s transactions and the records that support them.':'Your day, your requests, and your team. Everything here follows your permitted scope.'}</p><button className="link-button mt" onClick={()=>go(egg?'eggs':finance?'finance':'myday')}>{egg?'Open Collection Workspace':finance?'Open Finance Ledger':'Open My Day'}<ArrowRight size={17}/></button></div><div className="brief-numbers">{egg?<><div><span className="metric">3,612</span><small>Eggs Collected · Sample Day</small></div><div><span className="metric">02</span><small>Sample Collection Records</small></div></>:finance?<><div><span className="metric">₦560k</span><small>Recorded Income · Sample Day</small></div><div><span className="metric">₦310k</span><small>Recorded Costs · Sample Day</small></div></>:<><div><span className="metric">09:00</span><small>Sample Shift Start · WAT</small></div><div><span className="metric">01</span><small>Personal Request · Sample</small></div></>}</div></section>{egg?<Panel title="Collection Pulse" description="How has production changed across the sample period?" action={<Btn small onClick={()=>go('eggs')}>View Collections<ArrowUpRight size={15}/></Btn>}><div className="pulse-metrics"><div><small>Total Collected</small><div className="metric">{period==='Today'?'3,612':period==='Month'?'97,557':'24,427'} <small>eggs</small></div></div><div><small>{period==='Today'?'Collection Average':'Daily Average'}</small><div className="metric">{period==='Today'?'903':period==='Month'?'3,484':'3,490'} <small>eggs</small></div></div><div><small>Period</small><div className="metric">{period==='Today'?'1':period==='Month'?'28':'7'} <small>days</small></div></div></div><Suspense fallback={<p>Loading visualization…</p>}><Chart kind="eggs" period={period}/></Suspense></Panel>:finance?<Panel title="Income & Expense Movement" description="Compare recorded sample inflows and outflows."><Suspense fallback={<p>Loading visualization…</p>}><Chart kind="finance" period={period}/></Suspense></Panel>:<Panel title="Your Day, In Focus" description="Sample personal timeline"><Timeline items={[{time:'09:00 AM · WAT',title:'Start Your Shift',description:'Your personal attendance workspace is ready.'},{time:'Today',title:'Review Your Own Requests',description:'Follow the status of your submitted sample work requests.'},{time:'When You Have A Moment',title:'Build Your Knowledge',description:'Explore the learning content available to you.'}]}/></Panel>}<Panel title="Keep Work Moving" description="Go straight to the work you can act on."><div className="grid2">{shortcuts.map(p=><button className="record-row" key={p.id} onClick={()=>go(p.id)}><span className="list-symbol"><ArrowUpRight size={19}/></span><span className="grow"><strong>{p.title}</strong><small>{p.description}</small></span><ChevronRight size={16}/></button>)}</div></Panel></div><aside className="stack dashboard-aside"><Panel title="Needs Your Attention" description="Only items in your authorized scope" action={<Chip tone="amber">{notices.filter(n=>!n.read).length} Unread</Chip>}><div className="attention-list">{notices.slice(0,3).map(n=><div className="attention-item" key={n.id}><Chip tone={n.priority==='Review'?'amber':'gray'}>{n.priority}</Chip><strong>{n.title}</strong><p>{n.detail}</p><button className="link-button" onClick={()=>go(n.page)}>Review Item <ArrowUpRight size={15}/></button></div>)}{!notices.length&&<p>Nothing requires your attention in this sample workspace.</p>}</div></Panel>{person.farm&&has(person,'weather.view')&&<Panel><Weather/></Panel>}{canPage(person,'knowledge')&&<Panel className="dark-panel"><div className="eyebrow">A Little Progress, Every Day</div><h2 style={{margin:'17px 0'}}>Build confidence.<br/>One useful insight at a time.</h2><p style={{fontSize:'.875rem'}}>Learn the routines that support clear, consistent work.</p><Btn className="mt" onClick={()=>go('knowledge')}>Explore The Knowledge Center<ArrowUpRight size={16}/></Btn></Panel>}</aside></div>}
export function Profile({person,go,detail,reduced,setReduced}:WorkspaceProps){const [tab,setTab]=useState('Overview'),[alerts,setAlerts]=useState(true);const selfActions=[['leave','Leave Context','1 Pending Request'],['payslips','Your Payslips','August Sample Statement'],['loans','Loan Context','Sample Repayment Schedule'],['performance','Performance','2 Sample Goals']].filter(([id])=>canPage(person,id));return <div className="profile-layout"><aside className="panel identity-card"><div className="identity-banner"/><div className="identity-details"><div className="avatar large">{person.initials}</div><Chip tone={person.id==='provisional'?'amber':'green'}>{person.id==='provisional'?'Awaiting Approval':'Sample Profile'}</Chip><h2 style={{marginTop:13}}>{person.name}</h2><p className="job">{person.job}</p><dl className="identity-facts">{[['Employee Number',person.employeeId],['Department',person.department],['Business Scope',person.farm?'Farms · Sample Assignment':'No Farm Assignment'],['Site',person.farm?'Sample Farm Site':'Not Assigned'],['Employment Status',['provisional','expired','no-role'].includes(person.id)?'Not Yet Confirmed':'Active · Sample'],['Email',`${person.id}@example.invalid`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></aside><div className="stack"><Lens className="tabs-line" items={['Overview',...(has(person,'profile.security.view')?['Account & Security']:[]),...(has(person,'profile.preferences.view')?['Preferences']:[])]} value={tab} onChange={setTab}/>{tab==='Overview'?<>{person.id==='provisional'&&<div className="auth-state">Your sample account is awaiting an Owner decision. Work modules remain hidden until effective access and scope are resolved.</div>}<Panel title={person.id==='owner'?'Your Leadership Workspace':'Your Work Identity'} description="Your own profile and authorized work context"><div className="form-grid">{[['Display Name',person.name],['Job Title',person.job],['Department',person.department],['Phone','Not Provided']].map(([label,value])=><div className="field" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div>{has(person,'profile.edit')&&<button className="link-button mt" onClick={()=>detail('Edit My Profile',<div className="stack"><p>Identity updates must preserve the existing self-profile field allowlist. Role, department and employment changes remain administrative.</p><label className="field">Display Name<input defaultValue={person.name}/></label><label className="field">Phone<input placeholder="Your contact number"/></label><Btn primary onClick={()=>toast.success('Sample Profile Draft Reviewed',{description:'No account changes were sent.'})}>Review Sample Change</Btn></div>)}>Review Editable Profile Fields <ArrowUpRight size={17}/></button>}</Panel>{selfActions.length>0&&<div className="profile-summary">{selfActions.map(([id,title,value])=><button key={id} className="panel" style={{textAlign:'left'}} onClick={()=>go(id)}><div className="row between"><h3>{title}</h3><ArrowUpRight size={18}/></div><p style={{marginTop:15,fontSize:'.875rem'}}>{value}</p><small style={{display:'block',marginTop:10}}>Your Information Only</small></button>)}</div>}<Panel title="Your Account Journey" description="Sample personal activity"><Timeline items={[{time:'Current Sample Session',title:'Profile Opened',description:'You are viewing your own identity and work context.'},{time:'Sample Onboarding',title:'Account Created',description:'Employment and access are governed by existing Daenem workflows.'}]}/></Panel></>:tab==='Account & Security'?<><Panel title="Sign-In Methods" description="Linked identity presentation; sample state only"><RecordList items={[{title:'Local Password',detail:'Password identity · Sample linked state',status:'Sample',icon:<KeyRound size={18}/>},{title:'Google',detail:'Not linked in this sample profile',status:'Not Linked',icon:<Mail size={18}/>},{title:'Microsoft',detail:'Not linked in this sample profile',status:'Not Linked',icon:<Monitor size={18}/>}]} onOpen={i=>detail('Authentication Method',<div className="stack"><p>Identity linking must use the existing Daenem provider rules. Client code cannot link or unlink identities by changing a local flag.</p><Chip tone="gray">Production Connection Required</Chip></div>)}/></Panel><Panel title="Sessions & Devices" description="No live session information is available"><div className="row"><span className="list-symbol"><Monitor/></span><div><h3>Design Preview Session</h3><p style={{fontSize:'.875rem',marginTop:6}}>Sample desktop device · No real IP or access token shown</p></div></div><p className="form-note mt">A self-service sessions contract has not yet been verified. Administrative account sessions routes are not reused for ordinary employees.</p></Panel><Panel title="Recent Account Activity"><Timeline items={[{time:'Sample Event',title:'Profile Viewed',description:'Your own account activity presentation.'}]}/></Panel></>:<><Panel title="Your Preferences" description="Preview-only choices for this session"><label className="setting-row"><div><strong>Notification Updates</strong><p>Preview personal notification preferences.</p></div><Switch checked={alerts} onCheckedChange={setAlerts}/></label><label className="setting-row"><div><strong>Reduced Motion</strong><p>Keep motion to a minimum.</p></div><Switch checked={reduced} onCheckedChange={setReduced}/></label><label className="setting-row"><div><strong>Weather Unit</strong><p>Use the existing preference during integration.</p></div><select aria-label="Weather Unit" className="btn"><option>Celsius</option><option>Fahrenheit</option></select></label><p className="form-note mt">Preferences here are session-local design samples; backend persistence remains unconnected.</p></Panel></>}</div></div>}
type AttendanceSession = {
  id:string;
  state:'clocked-in'|'clocked-out';
  revision:number;
  data:{kind:'attendance-session';reference:string;subjectId:string;occurredAt:string;endedAt?:string};
};
const watDate=(value:string)=>new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));

const elapsedTime=(value:string,now:number)=>{
  const seconds=Math.max(0,Math.floor((now-Date.parse(value))/1000));
  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60);
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
};
export function MyDay({person,detail,go}:WorkspaceProps){
  const [attendanceState,setAttendanceState]=useState<'loading'|'ready'|'sign-in'|'unavailable'>('loading');
  const [sessions,setSessions]=useState<AttendanceSession[]>([]);
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(()=>Date.now());
  const loadAttendance=useCallback(async()=>{
    setAttendanceState('loading');
    try{
      const response=await fetch('/api/portal/v7/people-hr/attendance-session',{credentials:'same-origin',headers:{accept:'application/json'}});
      if(response.status===401){setSessions([]);setAttendanceState('sign-in');return}
      if(!response.ok)throw new Error('attendance-unavailable');
      const payload=await response.json() as {items?:unknown};
      if(!Array.isArray(payload.items))throw new Error('invalid-attendance-response');
      const valid=payload.items.every((item)=>Boolean(item&&typeof item==='object'&&'id'in item&&typeof item.id==='string'&&'state'in item&&(item.state==='clocked-in'||item.state==='clocked-out')&&'revision'in item&&Number.isInteger(item.revision)&&item.revision>0&&'data'in item&&item.data&&typeof item.data==='object'&&!Array.isArray(item.data)));
      if(!valid)throw new Error('invalid-attendance-response');
      setSessions(payload.items as AttendanceSession[]);
      setAttendanceState('ready');
    }catch{
      setSessions([]);
      setAttendanceState('unavailable');
    }
  },[]);
  useEffect(()=>{void loadAttendance()},[loadAttendance]);
  const openSession=sessions.find(session=>session.state==='clocked-in');
  useEffect(()=>{
    if(!openSession)return;
    setNow(Date.now());
    const interval=window.setInterval(()=>setNow(Date.now()),30000);
    return()=>window.clearInterval(interval);
  },[openSession?.id]);
  const clock=async()=>{
    if(busy||attendanceState!=='ready')return;
    setBusy(true);
    try{
      if(!openSession){
        const response=await fetch('/api/portal/v7/people-hr/attendance-session',{method:'POST',credentials:'same-origin',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({data:{kind:'attendance-session'}})});
        if(!response.ok){
          if(response.status===409){toast.info('An open attendance session already exists. Refreshing the server record.');await loadAttendance();return}
          throw new Error('clock-in-failed');
        }
        toast.success('Clock-in recorded',{description:'Your attendance session is now stored by the authorized server.'});
      }else{
        const transition=await fetch('/api/portal/v7/people-hr/attendance-session/'+openSession.id,{method:'POST',credentials:'same-origin',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({to:'clocked-out',expectedRevision:openSession.revision})});
        if(!transition.ok)throw new Error(transition.status===409?'attendance-changed':'clock-out-failed');
        toast.success('Clock-out recorded',{description:'The completed shift is stored with server-confirmed timestamps.'});
      }
      await loadAttendance();
    }catch(error){
      toast.error(error instanceof Error&&error.message==='attendance-changed'?'This attendance record changed on the server. The current version has been loaded.':'Attendance could not be updated',{description:'No unconfirmed change is shown. Please try again when the authorized service is available.'});
      await loadAttendance();
    }finally{setBusy(false)}
  };
  const shortcuts=[
    ["notifications","Notifications","Review updates in your permitted scope."],
    ["leave","Leave","Review your own leave context."],
    ["knowledge","Knowledge & Training","Open authorized guidance and learning."],
  ].filter(([id])=>canPage(person,id));
  const completed=sessions.filter(session=>session.state==='clocked-out').length;
  const statusCopy=attendanceState==='loading'?'Checking Attendance Service':attendanceState==='sign-in'?'Sign In Required':attendanceState==='unavailable'?'Attendance Service Unavailable':openSession?'Clocked In · Server Confirmed':'Ready To Clock In';
  return <div className="day-layout">
    <Panel className="shift-card">
      <div aria-live="polite">
        <Chip tone={attendanceState==='unavailable'||attendanceState==='sign-in'?'amber':openSession?'green':'blue'}>{statusCopy}</Chip>
        <h2 style={{marginTop:18}}>Your Time Matters.</h2>
        <p style={{fontSize:'.875rem',marginTop:10}}>Clock-in and clock-out are stored in the authorized attendance service and limited to your authenticated identity.</p>
      </div>
      <div className="shift-ring">
        <span className="metric">{openSession?elapsedTime(openSession.data.occurredAt,now):'—'}</span>
        <small>{openSession?<>Started <LoggedTimestamp value={openSession.data.occurredAt}/></>:attendanceState==='ready'?'No open attendance session':'Waiting for the authorized source'}</small>
      </div>
      <div className="shift-action">
        {has(person,'attendance.create')&&<Btn primary disabled={busy||attendanceState!=='ready'} onClick={()=>void clock()}><Clock3 size={18}/><AsyncButtonLabel busy={busy} idle={openSession?'Clock Out':'Clock In'} busyText={openSession?'Clocking Out…':'Clocking In…'}/></Btn>}
        <small>Location Not Requested · Server-Time Authority · Online Confirmation Required</small>
      </div>
    </Panel>
    <div className="stack">
      <Panel title="Your Work Today" description="Permission-filtered self-service shortcuts; no invented task counts or due dates.">
        {shortcuts.length?<div className="grid2">{shortcuts.map(([id,label,description])=><button className="record-row" key={id} onClick={()=>go(id)}><span className="list-symbol"><ArrowUpRight size={18}/></span><span className="grow"><strong>{label}</strong><small>{description}</small></span><ChevronRight size={16}/></button>)}</div>:<p>No additional self-service destination is available in your current access.</p>}
        <p className="form-note mt">Assigned tasks, approvals and due dates remain withheld until an authorized task source is connected.</p>
      </Panel>
      <Panel title="Attendance Summary" description="Counts are calculated only from your server-authorized attendance records.">
        <div className="pulse-metrics">
          <div><small>Recorded Shifts</small><div className="metric">{attendanceState==='ready'?sessions.length:'—'}</div></div>
          <div><small>Completed</small><div className="metric">{attendanceState==='ready'?completed:'—'}</div></div>
          <div><small>Open</small><div className="metric">{attendanceState==='ready'&&openSession?'1':attendanceState==='ready'?'0':'—'}</div></div>
        </div>
      </Panel>
      <Panel title="Attendance History" description="Your server-confirmed shift records · Africa/Lagos (WAT)">
        {attendanceState==='loading'?<p>Loading authorized attendance records…</p>:attendanceState==='sign-in'?<Empty title="Sign in required" detail="Your attendance records are available only in an authenticated session."/>:attendanceState==='unavailable'?<Empty title="Attendance unavailable" detail="The authorized attendance service did not return a valid response. No sample rows are shown."/>:sessions.length?<DataTable caption="Your authorized attendance records" headers={['Business Date','Clock In','Clock Out','Status']} rows={sessions.map(session=>[watDate(session.data.occurredAt),<LoggedTimestamp key={session.id+'-in'} value={session.data.occurredAt}/>,session.data.endedAt?<LoggedTimestamp key={session.id+'-out'} value={session.data.endedAt}/>:'—',<Chip key={session.id} tone={session.state==='clocked-in'?'green':'gray'}>{session.state==='clocked-in'?'Open':'Completed'}</Chip>])} onRow={index=>{const session=sessions[index];detail('Attendance Record',<div className="stack"><p><strong>Reference:</strong> {session.data.reference}</p><p><strong>Clock in:</strong> <LoggedTimestamp value={session.data.occurredAt}/></p><p><strong>Clock out:</strong> {session.data.endedAt?<LoggedTimestamp value={session.data.endedAt}/>:'Session remains open'}</p><p><strong>Server state:</strong> {session.state} · revision {session.revision}</p></div>)}}/>:<Empty title="No attendance records yet" detail="Clock in to create your first server-authorized attendance session."/>}
      </Panel>
      <div className="empty-grid">
        <WifiOff size={23}/>
        <div>
          <h3>Offline Attendance Not Enabled</h3>
          <p style={{fontSize:'.85rem'}}>Clock actions require an online server confirmation. No offline queue or GPS evidence is inferred.</p>
        </div>
      </div>
    </div>
  </div>;
}

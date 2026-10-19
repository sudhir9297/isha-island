export const COSMETIC_KEY = 'port.boat-pennant.v1';
export const PENNANTS = [
  {id:'shell',name:'Coral pennant',color:'#ed997c'},
  {id:'leaf',name:'Neem pennant',color:'#b8cf73'},
  {id:'stone',name:'Sky pennant',color:'#8fcbd1'},
];
export function availablePennant(id, items) {
  return PENNANTS.some(p=>p.id===id) && items.includes(id) ? id : null;
}

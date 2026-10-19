import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackPool,stepTracks,trackFadeBucket,isTrackSand} from './SandTracks.js';
import {dockWorldPoint,DOCK} from './WalkingSurface.js';
import {islandGroundAt} from './IslandGround.js';
test('marks reject water, wood and raised rocks',()=>{
 const dock=dockWorldPoint(0,4);assert.equal(isTrackSand(dock.x,dock.z,DOCK.deckHeight),false);
 assert.equal(isTrackSand(50,50,0),false);
 assert.equal(isTrackSand(-4,-5,islandGroundAt(-4,-5)+1),false);
 assert.equal(isTrackSand(-4,-5,islandGroundAt(-4,-5)),true);
});
test('footprints are bounded, fade away, and do not connect teleports or jumps',()=>{
 const pool=createTrackPool(4),p={x:-4,z:-5,y:islandGroundAt(-4,-5)};
 stepTracks(pool,p,0,.05,true);
 for(let i=0;i<12;i++){p.x=i%2?-4:-4.6;p.y=islandGroundAt(p.x,p.z);stepTracks(pool,p,0,.05,true);}
 assert.equal(pool.marks.length,4);assert.ok(pool.marks.some(m=>m.age===0));
 const index=pool.next;stepTracks(pool,{x:65,z:-48,y:0},0,.05,true);assert.equal(pool.next,index);
 stepTracks(pool,p,0,.05,false);assert.equal(pool.last,null);
 for(let i=0;i<600;i++)stepTracks(pool,p,0,.05,false);
 assert.ok(pool.marks.every(m=>trackFadeBucket(m)>=8));
});

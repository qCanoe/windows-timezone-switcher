const test = require('node:test');
const assert = require('node:assert/strict');
const {readZones, switchZone} = require('./zones.cjs');
test('reads installed Windows zones, validates requests, and preserves current zone', async () => {
 const zones=await readZones();
 assert.ok(zones.length>50);
 assert.equal(zones.filter(z=>z.current).length,1);
 assert.ok(zones.every(z=>typeof z.id==='string' && Number.isFinite(z.offset)));
 const current=zones.find(z=>z.current).id;
 const invalid=await switchZone('UTC"; bad-command');
 assert.equal(invalid.ok,false);
 const result=await switchZone(current);
 assert.equal(result.ok,true);
 assert.equal(result.unchanged,true);
 assert.equal((await readZones()).find(z=>z.current).id,current);
});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('assets/global-ui-canonical.css','utf8');
const tabs=css.match(/html body #cleanPageOutlet #r43Monitoring \.ge-assess-tabs > \.ge-assess-tab \{[^}]+\}/g)||[];
assert.equal(tabs.length,1,'one canonical base selector');
assert.match(tabs[0],/border-radius: 0/);
assert.match(tabs[0],/box-shadow: none/);
assert.match(tabs[0],/background: transparent/);
assert.match(tabs[0],/font-size: 13px/);
assert.match(tabs[0],/border-bottom: 2px solid transparent/);
assert.doesNotMatch(css,/\.ge-assess-tabs>button/);
for(const path of ['assets/form-management.js','assets/assessment-workspace.js']){
  const js=fs.readFileSync(path,'utf8');
  assert.match(js,/<a href=\"#(?:monitoring|assessment)-/);
  assert.match(js,/data-tab=/);
  assert.match(js,/e\.preventDefault\(\)/);
  assert.doesNotMatch(js,/<button type=\"button\" class=\"ge-assess-tab/);
}
console.log('MONITORING_FLAT_TABS_PASS');

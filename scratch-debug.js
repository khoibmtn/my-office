const fs = require('fs');
function injectDebug(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('fs.appendFileSync')) {
    content = "import * as fs from 'fs';\n" + content.replace('try {', "try {\n    fs.appendFileSync('/tmp/myoffice-api.log', `[${new Date().toISOString()}] HIT ${file}\\n`);\n");
    fs.writeFileSync(file, content);
  }
}
injectDebug('app/api/extension/upload/init/route.ts');
injectDebug('app/api/extension/submit/route.ts');
